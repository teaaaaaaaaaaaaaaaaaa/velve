const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { sendPushToUser } = require('../lib/pushNotifications')

// GET /api/chat — lista chat soba korisnika
router.get('/', requireAuth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.dbUser._id })
      .sort({ updatedAt: -1 })
      .populate('participants', 'displayName photoURL')
      .populate('tradeRequestId', 'status offeredItemId requestedItemId')
      .lean()

    // Fetch last message for each chat
    const data = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .populate('senderId', 'displayName')
          .lean()

        const messageCount = await Message.countDocuments({ chatId: chat._id })

        return {
          _id: chat._id,
          participants: chat.participants,
          tradeRequestId: chat.tradeRequestId,
          lastMessage,
          messageCount,
          updatedAt: chat.updatedAt,
        }
      })
    )

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

    // Fetch messages separately with pagination support
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const before = req.query.before // Optional message ID to fetch messages before

    const messageQuery = { chatId: chat._id }
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      const beforeMsg = await Message.findById(before)
      if (beforeMsg) {
        messageQuery.createdAt = { $lt: beforeMsg.createdAt }
      }
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'displayName photoURL')
      .lean()

    // Reverse to chronological order
    messages.reverse()

    res.json({ ok: true, data: { ...chat, messages } })
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

    // Create Message document
    const message = await Message.create({
      chatId: req.params.id,
      senderId: req.dbUser._id,
      text: text.trim().slice(0, 1000),
    })

    // Update chat's lastMessageAt
    await Chat.findByIdAndUpdate(req.params.id, { lastMessageAt: message.createdAt })

    // Populate sender info for response
    await message.populate('senderId', 'displayName photoURL')

    // Emit via socket.io if available
    const io = req.app.get('io')
    if (io) {
      io.to(`chat:${req.params.id}`).emit('new_message', {
        chatId: req.params.id,
        message,
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
