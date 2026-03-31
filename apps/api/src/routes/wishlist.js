const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Wishlist = require('../models/Wishlist')
const Item = require('../models/Item')

// POST /api/wishlist/:itemId — Add item to wishlist (idempotent)
router.post('/:itemId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    // Check if item exists
    const item = await Item.findOne({ _id: req.params.itemId, isDeleted: false })
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    // Cannot wishlist your own items
    if (item.userId.equals(req.dbUser._id)) {
      return res.status(400).json({ error: 'Cannot wishlist your own item' })
    }

    // Upsert - creates if doesn't exist, does nothing if already exists
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: req.dbUser._id, itemId: req.params.itemId },
      { userId: req.dbUser._id, itemId: req.params.itemId },
      { upsert: true, new: true }
    )

    res.json({ ok: true, data: wishlist })
  } catch (err) {
    // Handle duplicate key error gracefully
    if (err.code === 11000) {
      return res.json({ ok: true, message: 'Item already in wishlist' })
    }
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/wishlist/:itemId — Remove item from wishlist
router.delete('/:itemId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    await Wishlist.deleteOne({
      userId: req.dbUser._id,
      itemId: req.params.itemId,
    })

    res.json({ ok: true, message: 'Item removed from wishlist' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/wishlist — Get user's wishlist
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    const wishlistItems = await Wishlist.find({ userId: req.dbUser._id })
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit + 1)
      .populate({
        path: 'itemId',
        select: 'title images userId category condition status isDeleted',
        populate: {
          path: 'userId',
          select: 'displayName photoURL',
        },
      })
      .lean()

    // Filter out deleted items or items that no longer exist
    const validItems = wishlistItems.filter((w) => w.itemId && !w.itemId.isDeleted)

    const hasMore = validItems.length > limit
    const data = validItems.slice(0, limit)

    res.json({ ok: true, data, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
