const express = require('express')
const crypto = require('crypto')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { guestAnalyticsLimiter } = require('../middleware/rateLimit')
const Follow = require('../models/Follow')
const GuestFeedSlot = require('../models/GuestFeedSlot')
const {
  GuestAnalyticsEvent,
  GUEST_EVENT_TYPES,
} = require('../models/GuestAnalyticsEvent')
const Item = require('../models/Item')
const { enrichItems } = require('../lib/enrichItems')
const { rankFeedItems } = require('../lib/feedRanking')
const { getDiscoverySignals } = require('../lib/discovery')

const GUEST_FEED_LIMIT = 20
const GUEST_EVENT_SET = new Set(GUEST_EVENT_TYPES)

function clampText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function sanitizeGuestMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 12)
      .map(([key, value]) => [
        clampText(key, 48),
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? clampText(value, 160)
          : clampText(JSON.stringify(value), 160),
      ])
      .filter(([key]) => key)
  )
}

function hashIp(ip = '') {
  const salt = process.env.GUEST_ANALYTICS_HASH_SALT || process.env.FIREBASE_PROJECT_ID || 'velve'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

// GET /api/feed/guest - public curated preview for signed-out users
router.get('/guest', async (_req, res) => {
  try {
    const slots = await GuestFeedSlot.find({ active: true })
      .sort({ rank: 1, createdAt: 1 })
      .limit(GUEST_FEED_LIMIT)
      .populate({
        path: 'itemId',
        match: { status: 'available', isDeleted: false },
        populate: {
          path: 'userId',
          select: 'displayName photoURL averageRating completedTrades location',
        },
      })
      .lean()

    const items = slots
      .map((slot) => slot.itemId)
      .filter(Boolean)
      .filter((item) => item.userId)

    const data = await enrichItems(items, null)

    res.json({
      ok: true,
      data,
      page: 0,
      hasMore: false,
      mode: 'guest',
      maxVisible: GUEST_FEED_LIMIT,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/feed/guest/events - public no-PII guest funnel analytics
router.post('/guest/events', guestAnalyticsLimiter, async (req, res) => {
  try {
    const eventType = clampText(req.body.eventType, 80)
    const sessionId = clampText(req.body.sessionId, 120)
    const itemId = clampText(req.body.itemId, 40)

    if (!GUEST_EVENT_SET.has(eventType)) {
      return res.status(400).json({ error: 'Unsupported guest event type' })
    }

    if (!sessionId || sessionId.length < 8) {
      return res.status(400).json({ error: 'sessionId is required' })
    }

    if (itemId && !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid itemId' })
    }

    await GuestAnalyticsEvent.create({
      eventType,
      sessionId,
      ...(itemId ? { itemId } : {}),
      platform: clampText(req.body.platform, 40),
      route: clampText(req.body.route, 120),
      metadata: sanitizeGuestMetadata(req.body.metadata),
      ipHash: hashIp(req.ip),
      userAgent: clampText(req.get('user-agent'), 240),
    })

    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/feed — personalized feed with multi-factor ranking
// Formula: 30% freshness + 25% engagement + 25% preference match + 20% visual similarity
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)
    const isFirstTime = req.query.firstTime === 'true'
    const mode = req.query.mode === 'following' ? 'following' : 'for_you'
    const excludeIds = String(req.query.excludeIds || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const excludedIdSet = new Set(excludeIds)
    const signals = await getDiscoverySignals(req.dbUser._id)

    // Fetch MORE items (3x) for better personalization after ranking
    const fetchLimit = limit * 3

    const hiddenIds = signals.hiddenItemIds || []
    const blockedIds = signals.blockedUserIds || []
    const baseQuery = {
      ...(hiddenIds.length > 0 ? { _id: { $nin: hiddenIds } } : {}),
      status: 'available',
      isDeleted: false,
    }

    let ranked = []

    if (mode === 'following') {
      const following = await Follow.find({ followerId: req.dbUser._id }).select('followingId').lean()
      const followingIds = following
        .map((entry) => entry.followingId)
        .filter((entry) => entry && String(entry) !== String(req.dbUser._id))
        .filter((entry) => !blockedIds.some((blockedId) => String(blockedId) === String(entry)))

      if (followingIds.length === 0) {
        return res.json({ ok: true, data: [], page: 0, hasMore: false, mode })
      }

      ranked = await Item.find({
        ...baseQuery,
        userId: { $in: followingIds },
      })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .populate('userId', 'displayName photoURL averageRating completedTrades location')
        .lean()
    } else {
      const items = await Item.find({
        ...baseQuery,
        ...(blockedIds.length > 0
          ? { userId: { $nin: [req.dbUser._id, ...blockedIds] } }
          : { userId: { $ne: req.dbUser._id } }),
      })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .populate('userId', 'displayName photoURL averageRating completedTrades location')
        .lean()

      ranked = await rankFeedItems(items, req.dbUser, signals)

      // First-time user special treatment
      if (isFirstTime && ranked.length > limit) {
        // Filter: only show items with decent engagement or strong preference match
        ranked = ranked.filter(item => {
          return (item.normalizedEngagementScore || 0) >= 0.25 || item.preferenceScore >= 0.3
        })

        // Boost scores for strong matches (preference >= 0.7)
        ranked = ranked.map(item => {
          if (item.preferenceScore >= 0.7) {
            return { ...item, personalizedScore: item.personalizedScore * 1.5 }
          }
          return item
        })
      }

      // Fall back to highest-ranked discoveries when first-time filtering is too strict.
      if (ranked.length === 0 && items.length > 0) {
        ranked = await rankFeedItems(items, req.dbUser, signals)
      }

      // Sort by personalized score
      ranked.sort((a, b) => b.personalizedScore - a.personalizedScore)
    }

    if (excludedIdSet.size > 0) {
      ranked = ranked.filter((item) => !excludedIdSet.has(String(item._id)))
    }

    const seenIds = new Set()
    ranked = ranked.filter((item) => {
      const itemId = String(item._id)
      if (seenIds.has(itemId)) return false
      seenIds.add(itemId)
      return true
    })

    // Paginate AFTER ranking
    const start = excludedIdSet.size > 0 ? 0 : page * limit
    const end = start + limit
    const data = ranked.slice(start, end)
    const hasMore = ranked.length > end

    // Enrich with user-specific fields (isLiked, isWishlisted, likesCount)
    const enriched = await enrichItems(data, req.dbUser._id)

    res.json({
      ok: true,
      data: enriched,
      page: excludedIdSet.size > 0 ? 0 : page,
      hasMore,
      mode,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
