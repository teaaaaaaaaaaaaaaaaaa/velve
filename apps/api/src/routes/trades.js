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

    // Create trade request
    const trade = await TradeRequest.create({
      senderId: req.dbUser._id,
      receiverId,
      offeredItemId,
      requestedItemId,
      message: (message || '').slice(0, 300),
    })

    // Create chat room for this trade
    const chat = await Chat.create({
      participants: [req.dbUser._id, receiverId],
      tradeRequestId: trade._id,
      messages: [],
    })

    // Push notification to receiver
    sendPushToUser(receiverId, {
      title: 'New trade request!',
      body: `${req.dbUser.displayName || 'Someone'} wants to trade with you`,
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

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) return res.status(404).json({ error: 'Trade request not found' })

    // Only the receiver can accept/reject
    if (!trade.receiverId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Only the receiver can accept or reject' })
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: `Trade already ${trade.status}` })
    }

    trade.status = status
    await trade.save()

    // Push notification to sender
    const action = status === 'accepted' ? 'accepted' : 'declined'
    sendPushToUser(trade.senderId, {
      title: `Trade ${action}!`,
      body: `${req.dbUser.displayName || 'Someone'} ${action} your trade request`,
      data: { type: 'trade_update', tradeId: trade._id.toString(), status },
    })

    res.json({ ok: true, data: trade })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
