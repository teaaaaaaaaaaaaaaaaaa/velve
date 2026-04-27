const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Wishlist = require('../models/Wishlist')
const Item = require('../models/Item')
const { enrichItems } = require('../lib/enrichItems')
const { withPrimaryImage } = require('../lib/itemPresentation')
const { sendPushToUser } = require('../lib/pushNotifications')
const { createNotification } = require('../lib/notifications')

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

    if (item.status !== 'available') {
      return res.status(400).json({ error: 'Item is not currently available' })
    }

    // Cannot wishlist your own items
    if (item.userId.equals(req.dbUser._id)) {
      return res.status(400).json({ error: 'Cannot wishlist your own item' })
    }

    // Upsert - creates if doesn't exist, does nothing if already exists
    const existingWishlist = await Wishlist.exists({
      userId: req.dbUser._id,
      itemId: req.params.itemId,
    })

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: req.dbUser._id, itemId: req.params.itemId },
      { userId: req.dbUser._id, itemId: req.params.itemId },
      { upsert: true, new: true }
    )

    if (!existingWishlist) {
      createNotification({
        userId: item.userId,
        actorUserId: req.dbUser._id,
        type: 'item_wishlist',
        title: 'Komad je sacuvan',
        body: `${req.dbUser.displayName || 'Korisnik'} je sacuvao/la "${item.title}"`,
        itemId: item._id,
        data: { itemId: String(item._id), userId: String(req.dbUser._id) },
      })

      sendPushToUser(item.userId, {
        title: 'Komad je sacuvan',
        body: `${req.dbUser.displayName || 'Korisnik'} je sacuvao/la "${item.title}"`,
        data: {
          type: 'item_wishlist',
          itemId: String(item._id),
          userId: String(req.dbUser._id),
        },
      })
    }

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

// GET /api/wishlist — Get user's saved items
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
        select: 'title images imageClean isDigitized userId category brand size condition listingType price status isDeleted',
        populate: {
          path: 'userId',
          select: 'displayName photoURL averageRating completedTrades location',
        },
      })
      .lean()

    const validItems = wishlistItems
      .filter((entry) => entry.itemId && !entry.itemId.isDeleted && entry.itemId.status === 'available')
      .map((entry) => entry.itemId)

    const hasMore = validItems.length > limit
    const enriched = await enrichItems(validItems.slice(0, limit), req.dbUser._id)
    const data = enriched.map((item) => withPrimaryImage({ ...item, isWishlisted: true }))

    res.json({ ok: true, data, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
