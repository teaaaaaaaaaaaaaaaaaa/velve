const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Like = require('../models/Like')
const Item = require('../models/Item')
const { enrichItems } = require('../lib/enrichItems')
const { getPrimaryImage } = require('../lib/itemPresentation')
const { sendPushToUser } = require('../lib/pushNotifications')
const { createNotification } = require('../lib/notifications')

// GET /api/likes — lajkovani itemi trenutnog korisnika
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const page = Math.max(parseInt(req.query.page) || 0, 0)

    const likes = await Like.find({ userId: req.dbUser._id })
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit + 1)
      .populate({
        path: 'itemId',
        match: { isDeleted: false },
        select: 'title images userId brand size condition status',
        populate: { path: 'userId', select: 'displayName photoURL' },
      })
      .lean()

    const validItems = likes.filter((l) => l.itemId).map((l) => l.itemId)
    const enriched = await enrichItems(validItems, req.dbUser._id)
    const hasMore = validItems.length > limit
    const data = enriched.slice(0, limit).map((item) => ({ ...item, isLiked: true }))

    res.json({ ok: true, data, page, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items/:id/like — add like (idempotent)
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false }).lean()
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (item.status !== 'available') {
      return res.status(400).json({ error: 'Item is not currently available' })
    }

    if (String(item.userId) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'Cannot like your own item' })
    }

    const existingLike = await Like.exists({ userId: req.dbUser._id, itemId: req.params.id })

    await Like.findOneAndUpdate(
      { userId: req.dbUser._id, itemId: req.params.id },
      { userId: req.dbUser._id, itemId: req.params.id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const enriched = await enrichItems(item, req.dbUser._id)

    if (!existingLike) {
      const imageUrl = getPrimaryImage(item)
      createNotification({
        userId: item.userId,
        actorUserId: req.dbUser._id,
        type: 'item_like',
        title: 'Novi lajk',
        body: `${req.dbUser.displayName || 'Korisnik'} je lajkovao/la "${item.title}"`,
        itemId: item._id,
        data: { itemId: String(item._id), userId: String(req.dbUser._id), imageUrl },
      })

      sendPushToUser(item.userId, {
        title: 'Novi lajk',
        body: `${req.dbUser.displayName || 'Korisnik'} je lajkovao/la "${item.title}"`,
        imageUrl,
        data: {
          type: 'item_like',
          itemId: String(item._id),
          userId: String(req.dbUser._id),
          imageUrl,
        },
      })
    }

    res.json({
      ok: true,
      isLiked: enriched.isLiked,
      likesCount: enriched.likesCount,
    })
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
