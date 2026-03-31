const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')

// GET /api/feed — personalizovani feed sa cursor paginacijom
// Faza 1: najnoviji itemi, exclude own items
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const query = {
      userId: { $ne: req.dbUser._id }, // ne prikazuj sopstvene iteme
    }

    // Cursor-based pagination
    if (req.query.cursor) {
      query._id = { $lt: req.query.cursor }
    }

    const items = await Item.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('userId', 'displayName photoURL')
      .lean()

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null

    res.json({ ok: true, data: items, nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
