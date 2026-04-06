const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
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
    const signals = await getDiscoverySignals(req.dbUser._id)

    // Fetch MORE items (3x) for better personalization after ranking
    const fetchLimit = limit * 3

    const items = await Item.find({
      ...(signals.blockedUserIds.length > 0
        ? { userId: { $nin: [req.dbUser._id, ...signals.blockedUserIds] } }
        : { userId: { $ne: req.dbUser._id } }),
      ...(signals.hiddenItemIds.length > 0 ? { _id: { $nin: signals.hiddenItemIds } } : {}),
      status: 'available',
      isDeleted: false,
    })
      .sort({ createdAt: -1 }) // Sort by freshness first
      .limit(fetchLimit)
      .populate('userId', 'displayName photoURL')
      .lean()

    // Apply personalized ranking
    let ranked = await rankFeedItems(items, req.dbUser, signals)

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

    // Paginate AFTER ranking
    const start = page * limit
    const end = start + limit
    const data = ranked.slice(start, end)
    const hasMore = ranked.length > end

    // Enrich with user-specific fields (isLiked, isWishlisted, likesCount)
    const enriched = await enrichItems(data, req.dbUser._id)

    res.json({ ok: true, data: enriched, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
