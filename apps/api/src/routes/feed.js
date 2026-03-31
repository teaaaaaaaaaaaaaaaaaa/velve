const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')

// GET /api/feed — ranked feed: 60% freshness + 40% engagement
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    // Fetch a larger candidate pool, then rank and paginate
    const poolSize = Math.min((page + 1) * limit + 100, 500)

    const candidates = await Item.find({ userId: { $ne: req.dbUser._id } })
      .sort({ _id: -1 })
      .limit(poolSize)
      .populate('userId', 'displayName photoURL')
      .lean()

    if (candidates.length === 0) {
      return res.json({ ok: true, data: [], hasMore: false })
    }

    // Batch-fetch engagement counts
    const itemIds = candidates.map((i) => i._id)
    const [likeCounts, tradeCounts] = await Promise.all([
      Like.aggregate([
        { $match: { itemId: { $in: itemIds } } },
        { $group: { _id: '$itemId', count: { $sum: 1 } } },
      ]),
      TradeRequest.aggregate([
        { $match: { $or: [{ offeredItemId: { $in: itemIds } }, { requestedItemId: { $in: itemIds } }] } },
        { $group: { _id: { $cond: [{ $in: ['$offeredItemId', itemIds] }, '$offeredItemId', '$requestedItemId'] }, count: { $sum: 1 } } },
      ]),
    ])

    const likeMap = Object.fromEntries(likeCounts.map((l) => [l._id.toString(), l.count]))
    const tradeMap = Object.fromEntries(tradeCounts.map((t) => [t._id.toString(), t.count]))

    // Score each item
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days in ms

    const scored = candidates.map((item) => {
      const age = now - new Date(item.createdAt).getTime()
      const freshness = Math.max(0, 1 - age / maxAge) // 1.0 = brand new, 0.0 = 30+ days old

      const likes = likeMap[item._id.toString()] || 0
      const trades = tradeMap[item._id.toString()] || 0
      const engagement = Math.min((likes + trades * 2) / 10, 1) // normalize to 0-1, trades weigh 2x

      const score = 0.6 * freshness + 0.4 * engagement
      return { ...item, _score: score }
    })

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score)

    // Paginate
    const start = page * limit
    const slice = scored.slice(start, start + limit)
    const hasMore = start + limit < scored.length

    // Strip internal score
    const data = slice.map(({ _score, ...item }) => item)

    res.json({ ok: true, data, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
