const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const User = require('../models/User')
const Item = require('../models/Item')
const Follow = require('../models/Follow')

// GET /api/users/me — profil ulogovanog korisnika
router.get('/me', requireAuth, async (req, res) => {
  try {
    const followersCount = await Follow.countDocuments({ followingId: req.dbUser._id })
    const followingCount = await Follow.countDocuments({ followerId: req.dbUser._id })
    const itemsCount = await Item.countDocuments({ userId: req.dbUser._id })

    res.json({
      ok: true,
      data: {
        ...req.dbUser.toObject(),
        followersCount,
        followingCount,
        itemsCount,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me — ažuriraj profil
router.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['displayName', 'bio', 'photoURL']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    if (updates.displayName) updates.displayName = updates.displayName.slice(0, 50)
    if (updates.bio) updates.bio = updates.bio.slice(0, 200)

    const updated = await User.findByIdAndUpdate(req.dbUser._id, updates, { new: true })
    res.json({ ok: true, data: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/push-token — registruj Expo push token
router.put('/me/push-token', requireAuth, async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'token is required' })
    }

    await User.findByIdAndUpdate(req.dbUser._id, { expoPushToken: token })
    res.json({ ok: true, message: 'Push token saved' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/users/:id — javni profil korisnika
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const user = await User.findById(req.params.id).select('-firebaseUid').lean()
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const followersCount = await Follow.countDocuments({ followingId: req.params.id })
    const followingCount = await Follow.countDocuments({ followerId: req.params.id })
    const itemsCount = await Item.countDocuments({ userId: req.params.id })

    res.json({
      ok: true,
      data: { ...user, followersCount, followingCount, itemsCount },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
