const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const TradeRequest = require('../models/TradeRequest')
const Item = require('../models/Item')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { sendPushToUser } = require('../lib/pushNotifications')
const { getPrimaryImage } = require('../lib/itemPresentation')
const { createNotification } = require('../lib/notifications')

const TRADE_EXPIRY_HOURS = Math.max(Number(process.env.TRADE_EXPIRY_HOURS) || 72, 1)
const FINAL_ITEM_STATUSES = new Set(['sold', 'swapped', 'archived', 'traded'])

function getTradeExpiryDate(fromDate = new Date()) {
  return new Date(new Date(fromDate).getTime() + TRADE_EXPIRY_HOURS * 60 * 60 * 1000)
}

function isPendingTradeExpired(trade) {
  return trade.status === 'pending' && trade.expiresAt && new Date(trade.expiresAt).getTime() <= Date.now()
}

function getTradeRole(trade, userId) {
  return String(trade.senderId?._id || trade.senderId) === String(userId) ? 'sender' : 'receiver'
}

function getTradeKind(trade) {
  if (trade.type) return trade.type
  return trade.offeredItemId ? 'trade' : 'buy'
}

function getLifecycleBucket(trade) {
  if (trade.completedAt) return 'history'
  if (trade.status === 'accepted') return 'active'
  if (trade.status === 'pending') return 'pending'
  return 'history'
}

async function findTradeChat(trade) {
  return Chat.findOne({
    participants: { $all: [trade.senderId, trade.receiverId], $size: 2 },
  })
}

async function appendTradeStatusMessage(trade, actorId, status, label) {
  const chat = await findTradeChat(trade)
  if (!chat) return null

  const message = await Message.create({
    chatId: chat._id,
    senderId: actorId,
    text: label,
    type: 'trade_update',
    statusData: {
      tradeRequestId: trade._id,
      status,
      label,
    },
  })

  await Chat.findByIdAndUpdate(chat._id, { lastMessageAt: message.createdAt })
  return chat
}

async function syncItemTradeAvailability(itemIds = []) {
  const normalizedItemIds = [
    ...new Set(itemIds.filter(Boolean).map((itemId) => String(itemId))),
  ].filter((itemId) => mongoose.Types.ObjectId.isValid(itemId))

  if (normalizedItemIds.length === 0) return

  const objectIds = normalizedItemIds.map((itemId) => new mongoose.Types.ObjectId(itemId))
  const [items, acceptedTrades] = await Promise.all([
    Item.find({ _id: { $in: objectIds } }).select('_id status isDeleted').lean(),
    TradeRequest.find({
      status: 'accepted',
      completedAt: { $exists: false },
      $or: [
        { offeredItemId: { $in: objectIds } },
        { requestedItemId: { $in: objectIds } },
      ],
    })
      .select('offeredItemId requestedItemId')
      .lean(),
  ])

  const lockedItemIds = new Set()
  for (const trade of acceptedTrades) {
    if (trade.offeredItemId) lockedItemIds.add(String(trade.offeredItemId))
    if (trade.requestedItemId) lockedItemIds.add(String(trade.requestedItemId))
  }

  const updates = []
  for (const item of items) {
    if (!item || item.isDeleted || FINAL_ITEM_STATUSES.has(item.status)) {
      continue
    }

    const itemId = String(item._id)
    if (lockedItemIds.has(itemId) && item.status !== 'pending_trade') {
      updates.push(
        Item.findByIdAndUpdate(item._id, {
          status: 'pending_trade',
          unavailableReason: '',
        })
      )
      continue
    }

    if (!lockedItemIds.has(itemId) && item.status === 'pending_trade') {
      updates.push(
        Item.findByIdAndUpdate(item._id, {
          status: 'available',
        })
      )
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }
}

async function expirePendingTrades(baseQuery = {}) {
  const now = new Date()
  const expiringTrades = await TradeRequest.find({
    ...baseQuery,
    status: 'pending',
    expiresAt: { $lte: now },
  }).lean()

  if (expiringTrades.length === 0) {
    return []
  }

  const expiringIds = expiringTrades.map((trade) => trade._id)
  await TradeRequest.updateMany(
    { _id: { $in: expiringIds }, status: 'pending' },
    {
      status: 'expired',
      expiredAt: now,
      respondedAt: now,
    }
  )

  for (const trade of expiringTrades) {
    const chat = await appendTradeStatusMessage(
      trade,
      trade.receiverId,
      'expired',
      'Zahtev je istekao bez odgovora.'
    )

    sendPushToUser(trade.senderId, {
      title: 'Zahtev je istekao',
      body: 'Trade zahtev nije dobio odgovor na vreme.',
      data: {
        type: 'trade_expired',
        tradeId: String(trade._id),
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    createNotification({
      userId: trade.senderId,
      actorUserId: trade.receiverId,
      type: 'trade_expired',
      title: 'Zahtev je istekao',
      body: 'Trade zahtev nije dobio odgovor na vreme.',
      tradeId: trade._id,
      chatId: chat?._id,
      data: { tradeId: String(trade._id), chatId: chat?._id ? String(chat._id) : '' },
    })
  }

  return expiringIds
}

function serializeTrade(trade, viewerId) {
  const userRole = getTradeRole(trade, viewerId)
  const counterpart = userRole === 'sender' ? trade.receiverId : trade.senderId
  const kind = getTradeKind(trade)
  const bucket = getLifecycleBucket(trade)
  const isCompleted = Boolean(trade.completedAt)
  const canRate =
    isCompleted &&
    ((userRole === 'sender' && !trade.senderRating) ||
      (userRole === 'receiver' && !trade.receiverRating))

  return {
    ...trade,
    kind,
    userRole,
    counterpart,
    bucket,
    isCompleted,
    canAccept: userRole === 'receiver' && trade.status === 'pending',
    canReject: userRole === 'receiver' && trade.status === 'pending',
    canCancel:
      ['pending', 'accepted'].includes(trade.status) &&
      !trade.completedAt &&
      ((userRole === 'sender' && trade.status === 'pending') ||
        (userRole === 'receiver' && trade.status === 'accepted') ||
        (userRole === 'sender' && trade.status === 'accepted')),
    canComplete: trade.status === 'accepted' && !trade.completedAt,
    canRate,
    offeredItemId: trade.offeredItemId
      ? {
          ...trade.offeredItemId,
          primaryImage: getPrimaryImage(trade.offeredItemId),
        }
      : null,
    requestedItemId: trade.requestedItemId
      ? {
          ...trade.requestedItemId,
          primaryImage: getPrimaryImage(trade.requestedItemId),
        }
      : null,
  }
}

function matchesTradeFilters(trade, { bucket, role, status }) {
  if (status && trade.status !== status) return false
  if (role && trade.userRole !== role) return false
  if (bucket && trade.bucket !== bucket) return false
  return true
}

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
      if (trade.senderId.equals(userId) && trade.receiverRating) {
        ratings.push(trade.receiverRating)
      }
      if (trade.receiverId.equals(userId) && trade.senderRating) {
        ratings.push(trade.senderRating)
      }
    }

    const avgRating =
      ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

    await User.findByIdAndUpdate(userId, {
      averageRating: Math.round(avgRating * 10) / 10,
      totalRatings: ratings.length,
      completedTrades: trades.length,
    })
  } catch (err) {
    console.error(`Failed to update user rating for ${userId}:`, err.message)
  }
}

async function buildTradeQueryPayload(req) {
  await expirePendingTrades({
    $or: [{ senderId: req.dbUser._id }, { receiverId: req.dbUser._id }],
  })

  const trades = await TradeRequest.find({
    $or: [{ senderId: req.dbUser._id }, { receiverId: req.dbUser._id }],
  })
    .sort({ updatedAt: -1, _id: -1 })
    .populate('senderId', 'displayName photoURL averageRating completedTrades')
    .populate('receiverId', 'displayName photoURL averageRating completedTrades')
    .populate('offeredItemId', 'title images imageClean isDigitized status listingType')
    .populate('requestedItemId', 'title images imageClean isDigitized status listingType')
    .lean()

  return trades
    .map((trade) => serializeTrade(trade, req.dbUser._id))
    .filter((trade) =>
      matchesTradeFilters(trade, {
        bucket: req.query.bucket,
        role: req.query.role,
        status: req.query.status,
      })
    )
}

// GET /api/trades — lista trade requestova korisnika (sent + received)
router.get('/', requireAuth, async (req, res) => {
  try {
    const trades = await buildTradeQueryPayload(req)
    res.json({ ok: true, data: trades })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/trades/history — Get completed/finalized trades with ratings
router.get('/history', requireAuth, async (req, res) => {
  try {
    req.query.bucket = 'history'
    const trades = await buildTradeQueryPayload(req)
    res.json({ ok: true, data: trades })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trades — slanje trade requesta
router.post('/', requireAuth, async (req, res) => {
  try {
    const { offeredItemId, requestedItemId, message, offeredPrice } = req.body
    const isBuyRequest = !offeredItemId
    const normalizedOfferedPrice =
      offeredPrice === null || offeredPrice === undefined || offeredPrice === ''
        ? null
        : Number(offeredPrice)

    if (!requestedItemId) {
      return res.status(400).json({ error: 'requestedItemId is required' })
    }

    if (!isBuyRequest && !mongoose.Types.ObjectId.isValid(offeredItemId)) {
      return res.status(400).json({ error: 'Invalid offeredItemId' })
    }
    if (!mongoose.Types.ObjectId.isValid(requestedItemId)) {
      return res.status(400).json({ error: 'Invalid requestedItemId' })
    }

    if (
      normalizedOfferedPrice != null &&
      (!Number.isFinite(normalizedOfferedPrice) || normalizedOfferedPrice < 0)
    ) {
      return res.status(400).json({ error: 'offeredPrice must be a positive number' })
    }

    const [offeredItem, requestedItem] = await Promise.all([
      isBuyRequest ? Promise.resolve(null) : Item.findById(offeredItemId),
      Item.findById(requestedItemId),
    ])

    if (!isBuyRequest && !offeredItem) {
      return res.status(404).json({ error: 'Offered item not found' })
    }
    if (!requestedItem) {
      return res.status(404).json({ error: 'Requested item not found' })
    }

    if (!isBuyRequest && !offeredItem.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'You can only offer your own items' })
    }

    if (requestedItem.userId.equals(req.dbUser._id)) {
      return res.status(400).json({ error: 'Cannot trade with yourself' })
    }

    if (requestedItem.status !== 'available') {
      return res.status(400).json({ error: 'Requested item is not currently available' })
    }

    if (!isBuyRequest && offeredItem.status !== 'available') {
      return res.status(400).json({ error: 'Offered item is not currently available' })
    }

    if (isBuyRequest && !['sell', 'both'].includes(requestedItem.listingType)) {
      return res.status(400).json({ error: 'This item is not available for purchase' })
    }

    const receiverId = requestedItem.userId
    await expirePendingTrades({
      senderId: req.dbUser._id,
      requestedItemId,
    })

    const existingTrade = await TradeRequest.findOne({
      senderId: req.dbUser._id,
      requestedItemId,
      status: 'pending',
    })

    if (existingTrade) {
      const existingChat = await Chat.findOne({
        participants: { $all: [req.dbUser._id, receiverId], $size: 2 },
      })
      if (existingChat) {
        return res.json({ ok: true, data: { trade: existingTrade, chatId: existingChat._id } })
      }

      return res.status(400).json({ error: 'You already have a pending trade request for this item' })
    }

    const trade = await TradeRequest.create({
      senderId: req.dbUser._id,
      receiverId,
      type: isBuyRequest ? 'buy' : 'trade',
      ...(offeredItem ? { offeredItemId: offeredItem._id } : {}),
      ...(normalizedOfferedPrice != null ? { offeredPrice: normalizedOfferedPrice } : {}),
      requestedItemId,
      message: (message || '').slice(0, 300),
      expiresAt: getTradeExpiryDate(),
    })

    let chat = await Chat.findOne({
      participants: { $all: [req.dbUser._id, receiverId], $size: 2 },
    })

    if (!chat) {
      chat = await Chat.create({
        participants: [req.dbUser._id, receiverId],
        tradeRequestId: trade._id,
      })
    } else {
      await Chat.findByIdAndUpdate(chat._id, { tradeRequestId: trade._id })
    }

    const senderName = req.dbUser.displayName || 'Korisnik'

    if (isBuyRequest) {
      const priceCopy =
        normalizedOfferedPrice != null
          ? `${senderName} nudi ${normalizedOfferedPrice} EUR za "${requestedItem.title}"`
          : `${senderName} zeli da kupi "${requestedItem.title}"`

      await Message.create({
        chatId: chat._id,
        senderId: req.dbUser._id,
        type: 'buy',
        text: priceCopy,
        buyData: {
          tradeRequestId: trade._id,
          requestedItemId: requestedItem._id,
          requestedItemTitle: requestedItem.title,
          requestedItemImage: getPrimaryImage(requestedItem),
          ...(normalizedOfferedPrice != null ? { offeredPrice: normalizedOfferedPrice } : {}),
        },
      })
    } else {
      await Message.create({
        chatId: chat._id,
        senderId: req.dbUser._id,
        type: 'trade',
        text: `${senderName} zeli da zameni "${offeredItem.title}" za "${requestedItem.title}"`,
        tradeData: {
          tradeRequestId: trade._id,
          offeredItemId: offeredItem._id,
          offeredItemTitle: offeredItem.title,
          offeredItemImage: getPrimaryImage(offeredItem),
          requestedItemId: requestedItem._id,
          requestedItemTitle: requestedItem.title,
          requestedItemImage: getPrimaryImage(requestedItem),
        },
      })
    }

    await Chat.findByIdAndUpdate(chat._id, { lastMessageAt: new Date() })

    const pushBody = isBuyRequest
      ? normalizedOfferedPrice != null
        ? `${senderName} nudi ${normalizedOfferedPrice} EUR za tvoj predmet`
        : `${senderName} zeli da kupi "${requestedItem.title}"`
      : `${senderName} zeli da zameni "${offeredItem.title}" za tvoj predmet`

    sendPushToUser(receiverId, {
      title: isBuyRequest ? 'Novi zahtev za kupovinu' : 'Novi zahtev za razmenu',
      body: pushBody,
      data: {
        type: 'trade_request',
        tradeId: trade._id.toString(),
        chatId: chat._id.toString(),
      },
    })

    createNotification({
      userId: receiverId,
      actorUserId: req.dbUser._id,
      type: 'trade_request',
      title: isBuyRequest ? 'Novi zahtev za kupovinu' : 'Novi zahtev za razmenu',
      body: pushBody,
      itemId: requestedItem._id,
      tradeId: trade._id,
      chatId: chat._id,
      data: { tradeId: String(trade._id), chatId: String(chat._id), itemId: String(requestedItem._id) },
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

    await expirePendingTrades({ _id: req.params.id })

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) {
      return res.status(404).json({ error: 'Trade request not found' })
    }

    if (!trade.receiverId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Only the receiver can accept or reject' })
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade already processed' })
    }

    const [requestedItem, offeredItem] = await Promise.all([
      Item.findById(trade.requestedItemId),
      trade.offeredItemId ? Item.findById(trade.offeredItemId) : Promise.resolve(null),
    ])

    if (!requestedItem || requestedItem.isDeleted) {
      return res.status(400).json({ error: 'Requested item is no longer available' })
    }

    if (status === 'accepted') {
      if (requestedItem.status !== 'available') {
        return res.status(400).json({ error: 'Requested item is no longer available' })
      }

      if (offeredItem) {
        if (offeredItem.isDeleted || !offeredItem.userId.equals(trade.senderId) || offeredItem.status !== 'available') {
          return res.status(400).json({ error: 'Offered item is no longer available' })
        }
      }
    }

    trade.status = status
    trade.respondedAt = new Date()
    if (status === 'accepted') {
      trade.acceptedAt = new Date()
    }
    await trade.save()

    if (status === 'accepted') {
      await syncItemTradeAvailability([trade.requestedItemId, trade.offeredItemId])
    }

    const actionLabel =
      status === 'accepted'
        ? 'Zahtev je prihvacen i komadi su sada u aktivnom trade toku.'
        : 'Zahtev je odbijen.'

    const chat = await appendTradeStatusMessage(trade, req.dbUser._id, status, actionLabel)

    sendPushToUser(trade.senderId, {
      title: status === 'accepted' ? 'Trade prihvacen' : 'Trade odbijen',
      body:
        status === 'accepted'
          ? `${req.dbUser.displayName || 'Korisnik'} je prihvatio tvoj zahtev`
          : `${req.dbUser.displayName || 'Korisnik'} je odbio tvoj zahtev`,
      data: {
        type: 'trade_update',
        tradeId: trade._id.toString(),
        status,
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    createNotification({
      userId: trade.senderId,
      actorUserId: req.dbUser._id,
      type: 'trade_update',
      title: status === 'accepted' ? 'Trade prihvacen' : 'Trade odbijen',
      body:
        status === 'accepted'
          ? `${req.dbUser.displayName || 'Korisnik'} je prihvatio tvoj zahtev`
          : `${req.dbUser.displayName || 'Korisnik'} je odbio tvoj zahtev`,
      tradeId: trade._id,
      chatId: chat?._id,
      data: { tradeId: String(trade._id), status, chatId: chat?._id ? String(chat._id) : '' },
    })

    res.json({ ok: true, data: serializeTrade(trade.toObject(), req.dbUser._id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trades/:id/cancel — cancel a pending or active trade
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid trade ID' })
    }

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    const isSender = trade.senderId.equals(req.dbUser._id)
    const isReceiver = trade.receiverId.equals(req.dbUser._id)
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to cancel this trade' })
    }

    if (!['pending', 'accepted'].includes(trade.status) || trade.completedAt) {
      return res.status(400).json({ error: 'Only pending or active trades can be cancelled' })
    }

    trade.status = 'cancelled'
    trade.cancelledAt = new Date()
    trade.cancelledBy = isSender ? 'sender' : 'receiver'
    trade.cancelledReason = String(req.body.reason || '').slice(0, 200)
    trade.respondedAt = trade.respondedAt || new Date()
    await trade.save()

    await syncItemTradeAvailability([trade.requestedItemId, trade.offeredItemId])

    const actorName = req.dbUser.displayName || 'Korisnik'
    const label =
      trade.status === 'cancelled'
        ? `${actorName} je otkazao trade zahtev.`
        : `${actorName} je zatvorio trade zahtev.`

    const chat = await appendTradeStatusMessage(trade, req.dbUser._id, 'cancelled', label)
    const recipientId = isSender ? trade.receiverId : trade.senderId

    sendPushToUser(recipientId, {
      title: 'Trade je otkazan',
      body: `${actorName} je otkazao trade tok`,
      data: {
        type: 'trade_cancelled',
        tradeId: trade._id.toString(),
        status: 'cancelled',
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    createNotification({
      userId: recipientId,
      actorUserId: req.dbUser._id,
      type: 'trade_cancelled',
      title: 'Trade je otkazan',
      body: `${actorName} je otkazao trade tok`,
      tradeId: trade._id,
      chatId: chat?._id,
      data: {
        tradeId: String(trade._id),
        status: 'cancelled',
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    res.json({ ok: true, data: serializeTrade(trade.toObject(), req.dbUser._id) })
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
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    if (trade.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted trades can be completed' })
    }

    const isSender = trade.senderId.equals(req.dbUser._id)
    const isReceiver = trade.receiverId.equals(req.dbUser._id)

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to complete this trade' })
    }

    if (trade.completedAt) {
      return res.json({
        ok: true,
        data: serializeTrade(trade.toObject(), req.dbUser._id),
        message: 'Trade already completed',
      })
    }

    trade.completedAt = new Date()
    trade.completedBy = isSender ? 'sender' : 'receiver'
    await trade.save()
    await Promise.all([updateUserRating(trade.senderId), updateUserRating(trade.receiverId)])

    const requestedItemStatus = trade.offeredItemId ? 'swapped' : 'sold'
    const requestedItemUpdate = Item.findByIdAndUpdate(trade.requestedItemId, {
      status: requestedItemStatus,
      archivedAt: new Date(),
      archivedReason: requestedItemStatus,
    })

    const updates = [requestedItemUpdate]
    if (trade.offeredItemId) {
      updates.push(
        Item.findByIdAndUpdate(trade.offeredItemId, {
          status: 'swapped',
          archivedAt: new Date(),
          archivedReason: 'swapped',
        })
      )
    }
    await Promise.all(updates)

    const actorName = req.dbUser.displayName || 'Korisnik'
    const chat = await appendTradeStatusMessage(
      trade,
      req.dbUser._id,
      'completed',
      `${actorName} je oznacio trade kao zavrsen.`
    )

    const recipientId = isSender ? trade.receiverId : trade.senderId
    sendPushToUser(recipientId, {
      title: 'Trade je zavrsen',
      body: `${actorName} je oznacio trade kao zavrsen`,
      data: {
        type: 'trade_complete',
        tradeId: trade._id.toString(),
        status: 'completed',
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    createNotification({
      userId: recipientId,
      actorUserId: req.dbUser._id,
      type: 'trade_complete',
      title: 'Trade je zavrsen',
      body: `${actorName} je oznacio trade kao zavrsen`,
      tradeId: trade._id,
      chatId: chat?._id,
      data: {
        tradeId: String(trade._id),
        status: 'completed',
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    res.json({ ok: true, data: serializeTrade(trade.toObject(), req.dbUser._id) })
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

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' })
    }

    const trade = await TradeRequest.findById(req.params.id)
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' })
    }

    if (!trade.completedAt) {
      return res.status(400).json({ error: 'Can only rate completed trades' })
    }

    const isSender = trade.senderId.equals(req.dbUser._id)
    const isReceiver = trade.receiverId.equals(req.dbUser._id)

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to rate this trade' })
    }

    if (isSender && trade.senderRating) {
      return res.status(400).json({ error: 'You have already rated this trade' })
    }
    if (isReceiver && trade.receiverRating) {
      return res.status(400).json({ error: 'You have already rated this trade' })
    }

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

    const ratedUserId = isSender ? trade.receiverId : trade.senderId
    await updateUserRating(ratedUserId)

    sendPushToUser(ratedUserId, {
      title: 'Nova ocena',
      body: `${req.dbUser.displayName || 'Korisnik'} je ostavio ocenu nakon trade-a`,
      data: {
        type: 'trade_rating',
        tradeId: trade._id.toString(),
      },
    })

    createNotification({
      userId: ratedUserId,
      actorUserId: req.dbUser._id,
      type: 'trade_rating',
      title: 'Nova ocena',
      body: `${req.dbUser.displayName || 'Korisnik'} je ostavio ocenu nakon trade-a`,
      tradeId: trade._id,
      data: { tradeId: String(trade._id) },
    })

    res.json({ ok: true, data: serializeTrade(trade.toObject(), req.dbUser._id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
