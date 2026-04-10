const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Follow = require('../models/Follow')
const Item = require('../models/Item')
const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')
const { enrichItems } = require('../lib/enrichItems')
const { rankFeedItems } = require('../lib/feedRanking')
const { getDiscoverySignals } = require('../lib/discovery')

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
        .populate('userId', 'displayName photoURL')
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
        .populate('userId', 'displayName photoURL')
        .lean()

      ranked = await rankFeedItems(items, req.dbUser, signals)

      // First-time user special treatment
      if (isFirstTime) {
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
