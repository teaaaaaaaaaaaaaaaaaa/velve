const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Follow = require('../models/Follow')
const User = require('../models/User')
const { createNotification } = require('../lib/notifications')

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

    const existingFollow = await Follow.exists({
      followerId: req.dbUser._id,
      followingId: req.params.id,
    })

    await Follow.findOneAndUpdate(
      { followerId: req.dbUser._id, followingId: req.params.id },
      { followerId: req.dbUser._id, followingId: req.params.id },
      { upsert: true }
    )

    if (!existingFollow) {
      createNotification({
        userId: targetUser._id,
        actorUserId: req.dbUser._id,
        type: 'follow',
        title: 'Novi pratilac',
        body: `${req.dbUser.displayName || 'Korisnik'} je poceo/la da te prati`,
        data: { userId: String(req.dbUser._id) },
      })
    }

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

async function buildConnectionPayload({ userId, mode, viewerId }) {
  const query = mode === 'followers' ? { followingId: userId } : { followerId: userId }
  const populatePath = mode === 'followers' ? 'followerId' : 'followingId'
  const connections = await Follow.find(query)
    .sort({ createdAt: -1 })
    .populate(populatePath, 'displayName photoURL bio averageRating completedTrades location')
    .lean()

  const users = connections.map((entry) => entry[populatePath]).filter(Boolean)
  const viewerFollowing = viewerId
    ? await Follow.find({ followerId: viewerId, followingId: { $in: users.map((user) => user._id) } })
        .select('followingId')
        .lean()
    : []
  const followingIds = new Set(viewerFollowing.map((entry) => String(entry.followingId)))

  return users.map((user) => ({
    ...user,
    isSelf: viewerId ? String(user._id) === String(viewerId) : false,
    isFollowing: followingIds.has(String(user._id)),
  }))
}

// GET /api/users/:id/followers
router.get('/:id/followers', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const data = await buildConnectionPayload({
      userId: req.params.id,
      mode: 'followers',
      viewerId: req.dbUser._id,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/users/:id/following
router.get('/:id/following', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const data = await buildConnectionPayload({
      userId: req.params.id,
      mode: 'following',
      viewerId: req.dbUser._id,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
