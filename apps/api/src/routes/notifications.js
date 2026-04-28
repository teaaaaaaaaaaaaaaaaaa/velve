const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Notification = require('../models/Notification')

// GET /api/notifications - notification center payload
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 40, 80)
    const notifications = await Notification.find({ userId: req.dbUser._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('actorUserId', 'displayName photoURL')
      .populate('itemId', 'title images imageClean primaryImage')
      .lean()

    const unreadCount = await Notification.countDocuments({
      userId: req.dbUser._id,
      readAt: null,
    })

    res.json({ ok: true, data: notifications, unreadCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/notifications/read - mark all read
router.put('/read', requireAuth, async (req, res) => {
  try {
    const readAt = new Date()
    await Notification.updateMany(
      { userId: req.dbUser._id, readAt: null },
      { readAt }
    )
    res.json({ ok: true, data: { readAt } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/notifications/:id/read - mark one read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID' })
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.dbUser._id },
      { readAt: new Date() },
      { new: true }
    ).lean()

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json({ ok: true, data: notification })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
