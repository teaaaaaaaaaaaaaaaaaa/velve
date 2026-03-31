const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')

// GET /api/feed — ranked feed: 60% freshness + 40% engagement
// Uses pre-computed engagementScore for performance
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    // Directly query with pre-computed score sorting
    const items = await Item.find({
      userId: { $ne: req.dbUser._id },
      status: 'available',
      isDeleted: false,
    })
      .sort({ engagementScore: -1 })
      .skip(page * limit)
      .limit(limit + 1) // Fetch one extra to check hasMore
      .populate('userId', 'displayName photoURL')
      .lean()

    const hasMore = items.length > limit
    const data = items.slice(0, limit)

    res.json({ ok: true, data, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
