const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const TradeRequest = require('../models/TradeRequest')
const Item = require('../models/Item')
const Chat = require('../models/Chat')
const { sendPushToUser } = require('../lib/pushNotifications')

// GET /api/trades — lista trade requestova korisnika (sent + received)
router.get('/', requireAuth, async (req, res) => {
  try {
    const trades = await TradeRequest.find({
      $or: [{ senderId: req.dbUser._id }, { receiverId: req.dbUser._id }],
    })
      .sort({ _id: -1 })
      .populate('senderId', 'displayName photoURL')
      .populate('receiverId', 'displayName photoURL')
      .populate('offeredItemId', 'title images')
      .populate('requestedItemId', 'title images')
      .lean()

    res.json({ ok: true, data: trades })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trades — slanje trade requesta
router.post('/', requireAuth, async (req, res) => {
  try {
    const { offeredItemId, requestedItemId, message } = req.body

    if (!offeredItemId || !requestedItemId) {
      return res.status(400).json({ error: 'offeredItemId and requestedItemId are required' })
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(offeredItemId)) {
      return res.status(400).json({ error: 'Invalid offeredItemId' })
    }
    if (!mongoose.Types.ObjectId.isValid(requestedItemId)) {
      return res.status(400).json({ error: 'Invalid requestedItemId' })
    }

    // Validate items exist
    const [offeredItem, requestedItem] = await Promise.all([
      Item.findById(offeredItemId),
      Item.findById(requestedItemId),
    ])

    if (!offeredItem) return res.status(404).json({ error: 'Offered item not found' })
    if (!requestedItem) return res.status(404).json({ error: 'Requested item not found' })

    // Sender must own the offered item
    if (!offeredItem.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'You can only offer your own items' })
    }

    // Cannot trade with yourself
    if (requestedItem.userId.equals(req.dbUser._id)) {
      return res.status(400).json({ error: 'Cannot trade with yourself' })
    }

    const receiverId = requestedItem.userId

    // Check for existing pending trade for this item
    const existingTrade = await TradeRequest.findOne({
      senderId: req.dbUser._id,
      requestedItemId,
      status: 'pending',
    })

    if (existingTrade) {
      // Vrati postojeći chat ako postoji
      const existingChat = await Chat.findOne({
        participants: { $all: [req.dbUser._id, receiverId], $size: 2 },
      })
      if (existingChat) {
        return res.json({ ok: true, data: { trade: existingTrade, chatId: existingChat._id } })
      }
      return res.status(400).json({ error: 'You already have a pending trade request for this item' })
    }

    // Create trade request
    const trade = await TradeRequest.create({
      senderId: req.dbUser._id,
      receiverId,
      offeredItemId,
      requestedItemId,
      message: (message || '').slice(0, 300),
    })

    // Reuse existing chat between these two users, or create new one
    let chat = await Chat.findOne({
      participants: { $all: [req.dbUser._id, receiverId], $size: 2 },
    })

    if (!chat) {
      chat = await Chat.create({
        participants: [req.dbUser._id, receiverId],
        tradeRequestId: trade._id,
      })
    } else {
      // Update tradeRequestId to latest trade
      await Chat.findByIdAndUpdate(chat._id, { tradeRequestId: trade._id })
    }

    // Send automatic trade card message
    const Message = require('../models/Message')
    const senderName = req.dbUser.displayName || 'Korisnik'
    await Message.create({
      chatId: chat._id,
      senderId: req.dbUser._id,
      type: 'trade',
      text: `${senderName} želi da zameni "${offeredItem.title}" za "${requestedItem.title}"`,
      tradeData: {
        offeredItemId: offeredItem._id,
        offeredItemTitle: offeredItem.title,
        offeredItemImage: offeredItem.images[0] || '',
        requestedItemId: requestedItem._id,
        requestedItemTitle: requestedItem.title,
        requestedItemImage: requestedItem.images[0] || '',
      },
    })

    await Chat.findByIdAndUpdate(chat._id, { lastMessageAt: new Date() })

    // Push notification to receiver
    sendPushToUser(receiverId, {
      title: 'Novi zahtev za razmenu!',
      body: `${senderName} želi da zameni "${offeredItem.title}" za tvoj predmet`,
      data: { type: 'trade_request', tradeId: trade._id.toString(), chatId: chat._id.toString() },
    })

    res.status(201).json({ ok: true, data: { trade, chatId: chat._id } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/trades/:id — prihvatanje ili odbijanje trade requesta
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trade ID' })
    }

    const { status } = req.body
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "rejected"' })
    }

    // First fetch to validate receiver
    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) return res.status(404).json({ error: 'Trade request not found' })

    // Only the receiver can accept/reject
    if (!trade.receiverId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Only the receiver can accept or reject' })
    }

    // Atomic update: only update if status is still 'pending'
    // This prevents race conditions where two concurrent requests try to accept/reject
    const updated = await TradeRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { status },
      { new: true }
    )

    if (!updated) {
      return res.status(400).json({ error: 'Trade already processed' })
    }

    // If accepted, mark both items as traded
    if (status === 'accepted') {
      await Promise.all([
        Item.findByIdAndUpdate(trade.offeredItemId, { status: 'traded' }),
        Item.findByIdAndUpdate(trade.requestedItemId, { status: 'traded' }),
      ])
    }

    // Push notification to sender
    const action = status === 'accepted' ? 'accepted' : 'declined'
    sendPushToUser(trade.senderId, {
      title: `Trade ${action}!`,
      body: `${req.dbUser.displayName || 'Someone'} ${action} your trade request`,
      data: { type: 'trade_update', tradeId: updated._id.toString(), status },
    })

    res.json({ ok: true, data: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/trades/:id/complete — Mark trade as completed
router.put('/:id/complete', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trade ID' })
    }

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) return res.status(404).json({ error: 'Trade not found' })

    // Only accepted trades can be completed
    if (trade.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted trades can be completed' })
    }

    // Only sender or receiver can mark as complete
    const isSender = trade.senderId.equals(req.dbUser._id)
    const isReceiver = trade.receiverId.equals(req.dbUser._id)

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to complete this trade' })
    }

    // If already completed, return
    if (trade.completedAt) {
      return res.json({ ok: true, data: trade, message: 'Trade already completed' })
    }

    // Mark as completed
    trade.completedAt = new Date()
    trade.completedBy = isSender ? 'sender' : 'receiver'
    await trade.save()

    res.json({ ok: true, data: trade })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trades/:id/rate — Rate the other user after trade completion
router.post('/:id/rate', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trade ID' })
    }

    const { rating, review } = req.body

    // Validate rating
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' })
    }

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) return res.status(404).json({ error: 'Trade not found' })

    // Can only rate completed trades
    if (!trade.completedAt) {
      return res.status(400).json({ error: 'Can only rate completed trades' })
    }

    // Determine if user is sender or receiver
    const isSender = trade.senderId.equals(req.dbUser._id)
    const isReceiver = trade.receiverId.equals(req.dbUser._id)

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to rate this trade' })
    }

    // Check if already rated
    if (isSender && trade.senderRating) {
      return res.status(400).json({ error: 'You have already rated this trade' })
    }
    if (isReceiver && trade.receiverRating) {
      return res.status(400).json({ error: 'You have already rated this trade' })
    }

    // Save rating
    if (isSender) {
      trade.senderRating = rating
      trade.senderReview = review ? String(review).slice(0, 300) : ''
      trade.senderRatedAt = new Date()
    } else {
      trade.receiverRating = rating
      trade.receiverReview = review ? String(review).slice(0, 300) : ''
      trade.receiverRatedAt = new Date()
    }

    await trade.save()

    // Update the rated user's average rating
    const ratedUserId = isSender ? trade.receiverId : trade.senderId
    await updateUserRating(ratedUserId)

    res.json({ ok: true, data: trade })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/trades/history — Get completed trades with ratings
router.get('/history', requireAuth, async (req, res) => {
  try {
    const role = req.query.role // 'sender' or 'receiver'

    const query = {
      completedAt: { $exists: true },
    }

    if (role === 'sender') {
      query.senderId = req.dbUser._id
    } else if (role === 'receiver') {
      query.receiverId = req.dbUser._id
    } else {
      query.$or = [{ senderId: req.dbUser._id }, { receiverId: req.dbUser._id }]
    }

    const trades = await TradeRequest.find(query)
      .sort({ completedAt: -1 })
      .populate('senderId', 'displayName photoURL averageRating')
      .populate('receiverId', 'displayName photoURL averageRating')
      .populate('offeredItemId', 'title images')
      .populate('requestedItemId', 'title images')
      .lean()

    res.json({ ok: true, data: trades })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Helper function to update user's average rating
async function updateUserRating(userId) {
  try {
    const User = require('../models/User')

    const trades = await TradeRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
      completedAt: { $exists: true },
    })

    const ratings = []
    for (const trade of trades) {
      // If user was sender, get receiver's rating of them
      if (trade.senderId.equals(userId) && trade.receiverRating) {
        ratings.push(trade.receiverRating)
      }
      // If user was receiver, get sender's rating of them
      if (trade.receiverId.equals(userId) && trade.senderRating) {
        ratings.push(trade.senderRating)
      }
    }

    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

    await User.findByIdAndUpdate(userId, {
      averageRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
      totalRatings: ratings.length,
      completedTrades: trades.length,
    })
  } catch (err) {
    console.error(`Failed to update user rating for ${userId}:`, err.message)
  }
}

module.exports = router
