const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const Item = require('../models/Item')
const { getPrimaryImage } = require('../lib/itemPresentation')
const { createChatMessage, markChatRead } = require('../lib/chatMessages')
const { messageLimiter } = require('../middleware/rateLimit')

async function enrichTradeImages(messages = []) {
  const itemIds = new Set()

  for (const message of messages) {
    if (message.tradeData?.offeredItemId) {
      itemIds.add(String(message.tradeData.offeredItemId))
    }
    if (message.tradeData?.requestedItemId) {
      itemIds.add(String(message.tradeData.requestedItemId))
    }
    if (message.buyData?.requestedItemId) {
      itemIds.add(String(message.buyData.requestedItemId))
    }
  }

  if (itemIds.size === 0) {
    return messages
  }

  const items = await Item.find({ _id: { $in: [...itemIds] } })
    .select('images imageClean isDigitized')
    .lean()

  const imageMap = new Map(items.map((item) => [String(item._id), getPrimaryImage(item)]))

  return messages.map((message) => ({
    ...message,
    tradeData: message.tradeData
      ? {
          ...message.tradeData,
          offeredItemImage:
            imageMap.get(String(message.tradeData.offeredItemId)) || message.tradeData.offeredItemImage || '',
          requestedItemImage:
            imageMap.get(String(message.tradeData.requestedItemId)) || message.tradeData.requestedItemImage || '',
        }
      : message.tradeData,
    buyData: message.buyData
      ? {
          ...message.buyData,
          requestedItemImage:
            imageMap.get(String(message.buyData.requestedItemId)) || message.buyData.requestedItemImage || '',
        }
      : message.buyData,
  }))
}

// GET /api/chat — lista chat soba korisnika
router.get('/', requireAuth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.dbUser._id,
      deletedFor: { $ne: req.dbUser._id },
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'displayName photoURL email')
      .populate('tradeRequestId', 'status type offeredPrice')
      .lean()

    // Fetch last message for each chat
    const data = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .populate('senderId', 'displayName')
          .lean()

        const [messageCount, unreadCount] = await Promise.all([
          Message.countDocuments({ chatId: chat._id }),
          Message.countDocuments({
            chatId: chat._id,
            senderId: { $ne: req.dbUser._id },
            'readBy.userId': { $ne: req.dbUser._id },
          }),
        ])

        return {
          _id: chat._id,
          participants: chat.participants,
          tradeRequestId: chat.tradeRequestId,
          lastMessage,
          messageCount,
          unreadCount,
          deletedFor: chat.deletedFor || [],
          updatedAt: chat.updatedAt,
        }
      })
    )

    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat/direct/:userId — nadje ili napravi direktni chat sa korisnikom
router.post('/direct/:userId', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }
    if (req.params.userId === req.dbUser._id.toString()) {
      return res.status(400).json({ error: 'Cannot chat with yourself' })
    }

    const existing = await Chat.findOne({
      participants: { $all: [req.dbUser._id, req.params.userId], $size: 2 },
    })

    if (existing) {
      await Chat.findByIdAndUpdate(existing._id, { $pull: { deletedFor: req.dbUser._id } })
      return res.json({ ok: true, data: { chatId: existing._id } })
    }

    const chat = await Chat.create({ participants: [req.dbUser._id, req.params.userId] })
    res.json({ ok: true, data: { chatId: chat._id } })
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
      .populate('participants', 'displayName photoURL email')
      .populate('tradeRequestId', 'status senderId receiverId type offeredPrice')
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

    // Reverse to chronological order and hydrate proposal images from current item assets.
    messages.reverse()
    const enrichedMessages = await enrichTradeImages(messages)

    const unreadCount = await Message.countDocuments({
      chatId: chat._id,
      senderId: { $ne: req.dbUser._id },
      'readBy.userId': { $ne: req.dbUser._id },
    })

    res.json({ ok: true, data: { ...chat, messages: enrichedMessages, unreadCount } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat/:id/message — slanje poruke (REST fallback, WebSocket je primarni)
router.post('/:id/message', requireAuth, messageLimiter, async (req, res) => {
  try {
    const message = await createChatMessage({
      chatId: req.params.id,
      sender: req.dbUser,
      text: req.body.text,
      io: req.app.get('io'),
      clientId: req.body.clientId,
    })
    res.json({ ok: true, data: message })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

// POST /api/chat/:id/read - mark every inbound message in the chat as read
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const result = await markChatRead({
      chatId: req.params.id,
      userId: req.dbUser._id,
      io: req.app.get('io'),
    })
    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

// DELETE /api/chat/:id/messages/:messageId - delete current user's text message
router.delete('/:id/messages/:messageId', requireAuth, async (req, res) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.messageId)
    ) {
      return res.status(400).json({ error: 'Invalid chat or message ID' })
    }

    const chat = await Chat.findById(req.params.id).lean()
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const isParticipant = chat.participants.some((p) => String(p) === String(req.dbUser._id))
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this chat' })
    }

    const message = await Message.findOne({
      _id: req.params.messageId,
      chatId: req.params.id,
      senderId: req.dbUser._id,
      type: 'text',
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    await Message.deleteOne({ _id: message._id })

    const io = req.app.get('io')
    if (io) {
      io.to(`chat:${req.params.id}`).emit('message_deleted', {
        chatId: req.params.id,
        messageId: req.params.messageId,
      })
    }

    res.json({ ok: true, message: 'Message deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/chat/:id - soft-delete only the current user's side of a chat
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chat ID' })
    }

    const chat = await Chat.findById(req.params.id)
    if (!chat) return res.status(404).json({ error: 'Chat not found' })

    const isParticipant = chat.participants.some((p) => p.equals(req.dbUser._id))
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this chat' })
    }

    await Chat.findByIdAndUpdate(req.params.id, { $addToSet: { deletedFor: req.dbUser._id } })

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${req.dbUser._id}`).emit('chat_deleted', { chatId: req.params.id })
    }

    res.json({ ok: true, message: 'Chat deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
