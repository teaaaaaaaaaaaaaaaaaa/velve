const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth, maybeAuth } = require('../middleware/auth')
const User = require('../models/User')
const Item = require('../models/Item')
const Follow = require('../models/Follow')
const BlockedUser = require('../models/BlockedUser')
const Report = require('../models/Report')
const TradeRequest = require('../models/TradeRequest')
const ItemView = require('../models/ItemView')
const { enrichItems } = require('../lib/enrichItems')
const {
  getDiscoverySignals,
  getBehavioralAffinity,
  getVisualSimilarity,
} = require('../lib/discovery')

const LIVE_ITEM_STATUSES = ['available', 'pending_trade', 'unavailable']
const DRAFT_ITEM_STATUSES = ['draft']
const ARCHIVE_ITEM_STATUSES = ['archived', 'sold', 'swapped', 'traded']

function buildOnboardingUpdates(body = {}) {
  const { stylePreferences, favoriteBrands, categories, sizes, location } = body

  const hasOnboardingPayload = [
    stylePreferences,
    favoriteBrands,
    categories,
    sizes,
    location,
  ].some((value) => value !== undefined)

  if (!hasOnboardingPayload) {
    return null
  }

  const updates = {
    onboardingCompleted: true,
  }

  if (Array.isArray(stylePreferences)) {
    updates.stylePreferences = stylePreferences.slice(0, 20)
  }

  if (Array.isArray(favoriteBrands)) {
    updates.favoriteBrands = favoriteBrands.slice(0, 20)
  }

  if (Array.isArray(categories)) {
    updates.categories = categories.slice(0, 20)
  }

  if (sizes && typeof sizes === 'object') {
    updates.sizes = {
      clothing: sizes.clothing ? String(sizes.clothing).slice(0, 10) : '',
      shoes: sizes.shoes ? String(sizes.shoes).slice(0, 10) : '',
    }
  }

  if (location && typeof location === 'object') {
    updates.location = {
      city: location.city ? String(location.city).slice(0, 100) : '',
      region: location.region ? String(location.region).slice(0, 100) : '',
    }
  }

  return updates
}

function calculateProfileCompleteness(user = {}) {
  let score = 0

  score += 13.3
  if (user.photoURL) score += 13.3
  if (user.bio) score += 13.3

  if (Array.isArray(user.stylePreferences) && user.stylePreferences.length > 0) score += 10
  if (Array.isArray(user.categories) && user.categories.length > 0) score += 10
  if (Array.isArray(user.favoriteBrands) && user.favoriteBrands.length > 0) score += 10
  if (user.sizes?.clothing) score += 10
  if (user.sizes?.shoes) score += 10
  if (user.location?.city) score += 10

  return Math.round(score)
}

function sortItemsByRequestedIds(items, sortedIds) {
  const order = new Map(sortedIds.map((id, index) => [String(id), index]))
  return [...items].sort((a, b) => {
    return (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER)
  })
}

function getFreshnessScore(createdAt) {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.max(0, 1 - ageDays / 45)
}

async function buildTrustMetrics(user) {
  const incomingTrades = await TradeRequest.find({ receiverId: user._id })
    .select('status cancelledBy')
    .lean()

  let measurableRequests = 0
  let respondedRequests = 0

  for (const trade of incomingTrades) {
    if (trade.status === 'accepted' || trade.status === 'rejected') {
      measurableRequests += 1
      respondedRequests += 1
      continue
    }

    if (trade.status === 'expired') {
      measurableRequests += 1
      continue
    }

    if (trade.status === 'cancelled' && trade.cancelledBy === 'receiver') {
      measurableRequests += 1
      respondedRequests += 1
    }
  }

  return {
    joinedAt: user.createdAt,
    responseRate: measurableRequests > 0
      ? Math.round((respondedRequests / measurableRequests) * 100)
      : null,
    successfulSwaps: user.completedTrades || 0,
    profileCompleteness: calculateProfileCompleteness(user),
  }
}

async function buildClosetCounts(userId) {
  const [live, drafts, archive, publicItems] = await Promise.all([
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: { $in: LIVE_ITEM_STATUSES },
    }),
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: { $in: DRAFT_ITEM_STATUSES },
    }),
    Item.countDocuments({
      userId,
      $or: [
        { isDeleted: true },
        { status: { $in: ARCHIVE_ITEM_STATUSES } },
      ],
    }),
    Item.countDocuments({
      userId,
      isDeleted: false,
      status: 'available',
    }),
  ])

  return {
    live,
    drafts,
    archive,
    publicItems,
  }
}

async function buildUserProfilePayload(userDoc, viewerId = null) {
  const user =
    typeof userDoc.toObject === 'function'
      ? userDoc.toObject()
      : { ...userDoc }

  const isSelf = viewerId ? String(viewerId) === String(user._id) : false

  const [
    followersCount,
    followingCount,
    closetCounts,
    trustMetrics,
    isFollowing,
  ] = await Promise.all([
    Follow.countDocuments({ followingId: user._id }),
    Follow.countDocuments({ followerId: user._id }),
    buildClosetCounts(user._id),
    buildTrustMetrics(user),
    viewerId && !isSelf
      ? Follow.exists({ followerId: viewerId, followingId: user._id })
      : false,
  ])

  return {
    ...user,
    followersCount,
    followingCount,
    itemsCount: isSelf ? closetCounts.live + closetCounts.drafts : closetCounts.publicItems,
    closetCounts: {
      live: closetCounts.live,
      drafts: closetCounts.drafts,
      archive: closetCounts.archive,
    },
    ...trustMetrics,
    isFollowing: Boolean(isFollowing),
    isSelf,
  }
}

async function saveCurrentUser(req, res, updates) {
  const updated = await User.findByIdAndUpdate(req.dbUser._id, updates, { new: true })
  const payload = await buildUserProfilePayload(updated, req.dbUser._id)
  res.json({ ok: true, data: payload })
}

async function buildRecentlyViewedItems(userId, limit = 8) {
  const [signals, recentViews] = await Promise.all([
    getDiscoverySignals(userId),
    ItemView.find({ userId })
      .sort({ lastViewedAt: -1 })
      .limit(Math.max(limit * 3, 12))
      .select('itemId')
      .lean(),
  ])

  const recentIds = [...new Set(recentViews.map((entry) => String(entry.itemId)))]
  if (recentIds.length === 0) {
    return []
  }

  const blockedObjectIds = signals.blockedUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))
  const hiddenObjectIds = signals.hiddenItemIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  const items = await Item.find({
    _id: {
      $in: recentIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id)),
      ...(hiddenObjectIds.length > 0 ? { $nin: hiddenObjectIds } : {}),
    },
    userId: {
      $nin: [userId, ...blockedObjectIds],
    },
    status: 'available',
    isDeleted: false,
  })
    .populate('userId', 'displayName photoURL averageRating completedTrades location')
    .lean()

  const sortedItems = sortItemsByRequestedIds(items, recentIds).slice(0, limit)
  return enrichItems(sortedItems, userId)
}

async function buildRecommendedItems(userId, limit = 10) {
  const [signals, recentViews] = await Promise.all([
    getDiscoverySignals(userId),
    ItemView.find({ userId })
      .sort({ lastViewedAt: -1 })
      .limit(20)
      .select('itemId')
      .lean(),
  ])

  const recentViewIds = recentViews
    .map((entry) => String(entry.itemId))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))

  const blockedObjectIds = signals.blockedUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))
  const excludedItemIds = [
    ...signals.hiddenItemIds,
    ...recentViewIds,
  ]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  const candidates = await Item.find({
    status: 'available',
    isDeleted: false,
    userId: { $nin: [userId, ...blockedObjectIds] },
    ...(excludedItemIds.length > 0 ? { _id: { $nin: excludedItemIds } } : {}),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(120)
    .populate('userId', 'displayName photoURL averageRating completedTrades location')
    .lean()

  if (candidates.length === 0) {
    return []
  }

  const scoredCandidates = candidates
    .map((item) => {
      const behavioralScore = getBehavioralAffinity(item, signals)
      const visualScore = getVisualSimilarity(item, signals)
      const freshnessScore = getFreshnessScore(item.createdAt)
      const recommendationScore =
        behavioralScore * 0.55 + visualScore * 0.3 + freshnessScore * 0.15

      return {
        ...item,
        recommendationScore,
      }
    })
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const hasMeaningfulSignals = scoredCandidates.some((item) => item.recommendationScore > 0.05)
  const selectedItems = (hasMeaningfulSignals ? scoredCandidates : candidates).slice(0, limit)

  return enrichItems(selectedItems, userId)
}

// GET /api/users/me - current signed-in user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const payload = await buildUserProfilePayload(req.dbUser, req.dbUser._id)
    res.json({ ok: true, data: payload })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/users/me/modules - recently viewed + recommendations for profile modules
router.get('/me/modules', requireAuth, async (req, res) => {
  try {
    const [recentlyViewed, recommended] = await Promise.all([
      buildRecentlyViewedItems(req.dbUser._id, 8),
      buildRecommendedItems(req.dbUser._id, 10),
    ])

    res.json({
      ok: true,
      data: {
        recentlyViewed,
        recommended,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me - update profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['displayName', 'bio', 'photoURL']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    if (updates.displayName) updates.displayName = updates.displayName.slice(0, 50)
    if (updates.bio) updates.bio = updates.bio.slice(0, 200)

    const onboardingUpdates = buildOnboardingUpdates(req.body)
    if (onboardingUpdates) {
      Object.assign(updates, onboardingUpdates)
    }

    await saveCurrentUser(req, res, updates)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/push-token - save Expo push token
router.put('/me/push-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'token is required' })
    }

    await User.findByIdAndUpdate(req.dbUser._id, { expoPushToken: token })
    res.json({ ok: true, message: 'Push token saved' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/onboarding - complete onboarding
async function handleOnboardingUpdate(req, res) {
  try {
    const updates = buildOnboardingUpdates(req.body)
    if (!updates) {
      return res.status(400).json({ error: 'Onboarding payload is required' })
    }

    await saveCurrentUser(req, res, updates)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

router.put('/me/onboarding', requireAuth, handleOnboardingUpdate)
router.post('/me/onboarding', requireAuth, handleOnboardingUpdate)
router.patch('/me/onboarding', requireAuth, handleOnboardingUpdate)

// POST /api/users/:id/block - block another user
router.post('/:id/block', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (String(req.params.id) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot block yourself' })
    }

    const targetUser = await User.findById(req.params.id).lean()
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const block = await BlockedUser.findOneAndUpdate(
      { userId: req.dbUser._id, blockedUserId: req.params.id },
      {
        userId: req.dbUser._id,
        blockedUserId: req.params.id,
        reason: String(req.body.reason || '').slice(0, 200),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ ok: true, data: block })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/users/:id/block - unblock user
router.delete('/:id/block', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    await BlockedUser.deleteOne({
      userId: req.dbUser._id,
      blockedUserId: req.params.id,
    })

    res.json({ ok: true, message: 'User unblocked' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/:id/report - report a profile
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (String(req.params.id) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot report yourself' })
    }

    const targetUser = await User.findById(req.params.id).lean()
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const reason = String(req.body.reason || '').trim().slice(0, 100)
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' })
    }

    const report = await Report.create({
      reporterId: req.dbUser._id,
      targetType: 'user',
      targetUserId: req.params.id,
      reason,
      details: String(req.body.details || '').trim().slice(0, 500),
    })

    res.status(201).json({ ok: true, data: report })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/users/:id - public user profile
router.get('/:id', maybeAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (req.dbUser) {
      const isBlockedRelation = await BlockedUser.exists({
        $or: [
          { userId: req.dbUser._id, blockedUserId: req.params.id },
          { userId: req.params.id, blockedUserId: req.dbUser._id },
        ],
      })

      if (isBlockedRelation) {
        return res.status(404).json({ error: 'User not found' })
      }
    }

    const user = await User.findById(req.params.id)
      .select('-firebaseUid -expoPushToken -email')
      .lean()
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const payload = await buildUserProfilePayload(user, req.dbUser?._id || null)
    res.json({ ok: true, data: payload })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
