const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Follow = require('../models/Follow')
const User = require('../models/User')

// POST /api/users/:id/follow — prati korisnika (idempotent)
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (req.params.id === req.dbUser._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' })
    }

    const targetUser = await User.findById(req.params.id)
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    await Follow.findOneAndUpdate(
      { followerId: req.dbUser._id, followingId: req.params.id },
      { followerId: req.dbUser._id, followingId: req.params.id },
      { upsert: true }
    )

    res.json({ ok: true, message: 'Following user' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/users/:id/follow — prestani da pratiš
router.delete('/:id/follow', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    await Follow.findOneAndDelete({ followerId: req.dbUser._id, followingId: req.params.id })
    res.json({ ok: true, message: 'Unfollowed user' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
