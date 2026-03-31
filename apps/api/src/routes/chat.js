const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Chat = require('../models/Chat')
const { sendPushToUser } = require('../lib/pushNotifications')

// GET /api/chat — lista chat soba korisnika
router.get('/', requireAuth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.dbUser._id })
      .sort({ updatedAt: -1 })
      .populate('participants', 'displayName photoURL')
      .populate('tradeRequestId', 'status offeredItemId requestedItemId')
      .lean()

    // Return chats with last message preview
    const data = chats.map((chat) => {
      const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null
      return {
        _id: chat._id,
        participants: chat.participants,
        tradeRequestId: chat.tradeRequestId,
        lastMessage,
        messageCount: chat.messages.length,
        updatedAt: chat.updatedAt,
      }
    })

    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/chat/:id — poruke u chat sobi
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chat ID' })
    }

    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'displayName photoURL')
      .populate('tradeRequestId')
      .lean()

    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    // Only participants can view
    const isParticipant = chat.participants.some((p) => p._id.equals(req.dbUser._id))
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this chat' })
    }

    res.json({ ok: true, data: chat })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat/:id/message — slanje poruke (REST fallback, WebSocket je primarni)
router.post('/:id/message', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chat ID' })
    }

    const { text } = req.body
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' })
    }

    const chat = await Chat.findById(req.params.id)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const isParticipant = chat.participants.some((p) => p.equals(req.dbUser._id))
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this chat' })
    }

    const message = {
      senderId: req.dbUser._id,
      text: text.trim().slice(0, 1000),
      createdAt: new Date(),
    }

    chat.messages.push(message)
    await chat.save()

    // Emit via socket.io if available
    const io = req.app.get('io')
    if (io) {
      io.to(`chat:${req.params.id}`).emit('new_message', {
        chatId: req.params.id,
        message: { ...message, senderId: { _id: req.dbUser._id, displayName: req.dbUser.displayName } },
      })
    }

    // Push notification to other participant
    const otherUserId = chat.participants.find((p) => !p.equals(req.dbUser._id))
    if (otherUserId) {
      sendPushToUser(otherUserId, {
        title: req.dbUser.displayName || 'New message',
        body: text.trim().slice(0, 100),
        data: { type: 'chat_message', chatId: chat._id.toString() },
      })
    }

    res.json({ ok: true, data: message })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
