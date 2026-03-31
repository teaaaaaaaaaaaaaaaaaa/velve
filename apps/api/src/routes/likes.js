const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Like = require('../models/Like')
const Item = require('../models/Item')

// POST /api/items/:id/like — lajkuj item (idempotent)
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    await Like.findOneAndUpdate(
      { userId: req.dbUser._id, itemId: req.params.id },
      { userId: req.dbUser._id, itemId: req.params.id },
      { upsert: true }
    )

    res.json({ ok: true, message: 'Item liked' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:id/like — ukloni lajk
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    await Like.findOneAndDelete({ userId: req.dbUser._id, itemId: req.params.id })
    res.json({ ok: true, message: 'Like removed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
