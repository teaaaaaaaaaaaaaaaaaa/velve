const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')
const { enrichItems } = require('../lib/enrichItems')
const { rankFeedItems } = require('../lib/feedRanking')

// GET /api/feed — personalized feed with multi-factor ranking
// Formula: 30% freshness + 25% engagement + 25% preference match + 20% visual similarity
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    // Fetch MORE items (3x) for better personalization after ranking
    const fetchLimit = limit * 3

    const items = await Item.find({
      userId: { $ne: req.dbUser._id },
      status: 'available',
      isDeleted: false,
    })
      .sort({ createdAt: -1 }) // Sort by freshness first
      .limit(fetchLimit)
      .populate('userId', 'displayName photoURL')
      .lean()

    // Apply personalized ranking
    const ranked = await rankFeedItems(items, req.dbUser)

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
