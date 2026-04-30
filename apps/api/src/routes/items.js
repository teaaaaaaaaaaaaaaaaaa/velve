const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth, maybeAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const User = require('../models/User')
const TradeRequest = require('../models/TradeRequest')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const HiddenItem = require('../models/HiddenItem')
const Report = require('../models/Report')
const ItemView = require('../models/ItemView')
const { sanitizeInput } = require('../lib/sanitize')
const { enrichItems } = require('../lib/enrichItems')
const { sendPushToUser } = require('../lib/pushNotifications')
const { getBlockedUserIds, getHiddenItemIds } = require('../lib/discovery')
const { getPrimaryImage, withPrimaryImage } = require('../lib/itemPresentation')
const { createItemCleanKey, uploadBuffer } = require('../lib/r2')
const { AI_SERVER_URL, generateEmbedding, addEmbeddingToIndex } = require('../lib/aiClient')

const OWNER_ACTIVE_STATUSES = ['available', 'pending_trade', 'unavailable']
const OWNER_DRAFT_STATUSES = ['draft']
const OWNER_ARCHIVE_STATUSES = ['archived', 'sold', 'swapped', 'traded']
const MANUAL_ITEM_STATUSES = ['draft', 'available', 'unavailable', 'archived']
const FINAL_ITEM_STATUSES = new Set(['sold', 'swapped', 'archived', 'traded'])

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeExactFilter(value, maxLength = 100) {
  if (!value) return null
  const safeValue = sanitizeInput(String(value)).slice(0, maxLength).trim()
  if (!safeValue) return null
  return new RegExp(`^${escapeRegex(safeValue)}$`, 'i')
}

function normalizeSearchRegex(value) {
  if (!value) return null
  const safeValue = sanitizeInput(String(value)).slice(0, 60).trim()
  if (!safeValue) return null
  return new RegExp(escapeRegex(safeValue), 'i')
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id)
}

// Fire-and-forget: generate CLIP embedding and push to FAISS index.
// On failure the periodic retryMissingEmbeddings job will catch it.
function generateEmbeddingAsync(itemId, imageUrl) {
  (async () => {
    try {
      const embedding = await generateEmbedding(imageUrl)
      await Item.findByIdAndUpdate(itemId, { embedding })
      await addEmbeddingToIndex(itemId, embedding).catch((err) =>
        console.warn(`[Embeddings] Index-add failed for ${itemId}: ${err.message}`)
      )
    } catch (err) {
      console.error(`Embedding failed for item ${itemId}: ${err.message}`)
    }
  })()
}

async function recordItemView(userId, itemId) {
  await ItemView.findOneAndUpdate(
    { userId, itemId },
    {
      $inc: { viewCount: 1 },
      $set: { lastViewedAt: new Date() },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
}

async function resolveLocationUserIds(city, region) {
  const locationQuery = {}

  if (city) {
    locationQuery['location.city'] = new RegExp(escapeRegex(String(city).slice(0, 100)), 'i')
  }

  if (region) {
    locationQuery['location.region'] = new RegExp(escapeRegex(String(region).slice(0, 100)), 'i')
  }

  if (Object.keys(locationQuery).length === 0) {
    return null
  }

  const users = await User.find(locationQuery).select('_id').lean()
  return users.map((user) => user._id.toString())
}

function sortItemsByRequestedIds(items, sortedIds) {
  const order = new Map(sortedIds.map((id, index) => [String(id), index]))
  return [...items].sort((a, b) => {
    return (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER)
  })
}

async function getNextSortOrder(userId) {
  const lastItem = await Item.findOne({ userId }).sort({ sortOrder: -1, createdAt: -1 }).select('sortOrder').lean()
  return Number(lastItem?.sortOrder || 0) + 1
}

function serializeClosetItem(item) {
  if (!item) return item

  const archiveStatus = item.isDeleted
    ? 'deleted'
    : item.status === 'sold'
      ? 'sold'
      : item.status === 'swapped' || item.status === 'traded'
        ? 'swapped'
        : item.status === 'archived'
          ? 'archived'
          : null

  return withPrimaryImage({
    ...item,
    archiveStatus,
  })
}

async function readErrorBody(response) {
  try {
    const body = await response.json()
    return body.detail || body.error || JSON.stringify(body)
  } catch {
    return response.text()
  }
}

function validatePublishableItem(item) {
  if (!item.title || !String(item.title).trim()) {
    return 'title is required to publish'
  }
  if (!item.category || !String(item.category).trim()) {
    return 'category is required to publish'
  }
  if (!item.condition || !['new', 'like_new', 'good', 'fair'].includes(item.condition)) {
    return 'condition must be one of: new, like_new, good, fair'
  }
  return null
}

function buildManualStatusUpdate(item, nextStatus, reason = '') {
  if (!MANUAL_ITEM_STATUSES.includes(nextStatus)) {
    return { error: 'Unsupported status transition' }
  }

  if (item.isDeleted) {
    return { error: 'Deleted items cannot be updated' }
  }

  if (item.status === 'pending_trade') {
    return { error: 'Item is in active trade flow and cannot change status right now' }
  }

  if (['sold', 'swapped', 'traded'].includes(item.status)) {
    return { error: 'Completed closet items cannot be moved back into active states' }
  }

  if (nextStatus === 'available') {
    const publishError = validatePublishableItem(item)
    if (publishError) {
      return { error: publishError }
    }

    return {
      status: 'available',
      archivedAt: null,
      archivedReason: '',
      unavailableReason: '',
    }
  }

  if (nextStatus === 'draft') {
    return {
      status: 'draft',
      archivedAt: null,
      archivedReason: '',
      unavailableReason: '',
    }
  }

  if (nextStatus === 'unavailable') {
    return {
      status: 'unavailable',
      unavailableReason: String(reason || 'manual_pause').slice(0, 80),
      archivedAt: null,
      archivedReason: '',
    }
  }

  return {
    status: 'archived',
    archivedAt: new Date(),
    archivedReason: String(reason || 'manual_archive').slice(0, 80),
    unavailableReason: '',
  }
}

async function buildClosetPayload(userId) {
  const items = await Item.find({ userId })
    .sort({ sortOrder: 1, updatedAt: -1, _id: -1 })
    .lean()

  const serializedItems = items.map(serializeClosetItem)
  const archiveItems = serializedItems
    .filter((item) => item.isDeleted || OWNER_ARCHIVE_STATUSES.includes(item.status))
    .sort((a, b) => {
      const left = new Date(a.archivedAt || a.deletedAt || a.updatedAt || 0).getTime()
      const right = new Date(b.archivedAt || b.deletedAt || b.updatedAt || 0).getTime()
      return right - left
    })

  return {
    live: serializedItems.filter((item) => !item.isDeleted && OWNER_ACTIVE_STATUSES.includes(item.status)),
    drafts: serializedItems.filter((item) => !item.isDeleted && OWNER_DRAFT_STATUSES.includes(item.status)),
    archive: archiveItems,
  }
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

async function syncAcceptedTradeAvailability(itemIds = []) {
  const normalizedIds = [
    ...new Set(itemIds.filter(Boolean).map((itemId) => String(itemId))),
  ].filter((itemId) => mongoose.Types.ObjectId.isValid(itemId))

  if (normalizedIds.length === 0) return

  const objectIds = normalizedIds.map((itemId) => toObjectId(itemId))
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
      updates.push(Item.findByIdAndUpdate(item._id, { status: 'pending_trade', unavailableReason: '' }))
      continue
    }

    if (!lockedItemIds.has(itemId) && item.status === 'pending_trade') {
      updates.push(Item.findByIdAndUpdate(item._id, { status: 'available' }))
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }
}

async function cancelTradesForItemMutation({ itemIds = [], actorUser, reason }) {
  const normalizedIds = [
    ...new Set(itemIds.filter(Boolean).map((itemId) => String(itemId))),
  ].filter((itemId) => mongoose.Types.ObjectId.isValid(itemId))

  if (normalizedIds.length === 0) {
    return
  }

  const objectIds = normalizedIds.map((itemId) => toObjectId(itemId))
  const trades = await TradeRequest.find({
    status: { $in: ['pending', 'accepted'] },
    completedAt: { $exists: false },
    $or: [
      { offeredItemId: { $in: objectIds } },
      { requestedItemId: { $in: objectIds } },
    ],
  })

  if (trades.length === 0) {
    return
  }

  const impactedAvailabilityIds = new Set()
  for (const trade of trades) {
    const isActorSender = String(trade.senderId) === String(actorUser._id)
    const otherUserId = isActorSender ? trade.receiverId : trade.senderId

    trade.status = 'cancelled'
    trade.cancelledAt = new Date()
    trade.cancelledBy = isActorSender ? 'sender' : 'receiver'
    trade.cancelledReason = String(reason || 'item_removed').slice(0, 200)
    trade.respondedAt = trade.respondedAt || new Date()
    await trade.save()

    const chat = await appendTradeStatusMessage(
      trade,
      actorUser._id,
      'cancelled',
      'Trade je automatski zatvoren jer je jedan od komada uklonjen iz ormara.'
    )

    sendPushToUser(otherUserId, {
      title: 'Trade je zatvoren',
      body: `${actorUser.displayName || 'Korisnik'} je uklonio komad iz ormara i zatvorio trade tok.`,
      data: {
        type: 'trade_cancelled',
        tradeId: String(trade._id),
        status: 'cancelled',
        chatId: chat?._id ? String(chat._id) : '',
      },
    })

    if (trade.offeredItemId) impactedAvailabilityIds.add(String(trade.offeredItemId))
    if (trade.requestedItemId) impactedAvailabilityIds.add(String(trade.requestedItemId))
  }

  await syncAcceptedTradeAvailability([...impactedAvailabilityIds])
}

// GET /api/items — searchable item list with cursor pagination
router.get('/', maybeAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const viewerId = req.dbUser?._id?.toString() || null
    const [blockedUserIds, hiddenItemIds] = viewerId
      ? await Promise.all([
          getBlockedUserIds(req.dbUser._id),
          getHiddenItemIds(req.dbUser._id),
        ])
      : [[], []]

    // ?archived=true — returns archived/sold/swapped/deleted items, but only for the owner.
    if (req.query.archived === 'true') {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Authentication required for archived items' })
      }

      if (!req.query.userId || !mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: 'Valid userId is required for archived query' })
      }

      if (viewerId !== String(req.query.userId)) {
        return res.status(403).json({ error: 'Not authorized to view archived items' })
      }

      const archivedQuery = {
        userId: toObjectId(req.query.userId),
        $or: [
          { isDeleted: true },
          { status: { $in: OWNER_ARCHIVE_STATUSES } },
        ],
      }

      if (req.query.cursor) {
        if (!mongoose.Types.ObjectId.isValid(req.query.cursor)) {
          return res.status(400).json({ error: 'Invalid cursor' })
        }
        archivedQuery._id = { $lt: toObjectId(req.query.cursor) }
      }

      const items = await Item.find(archivedQuery)
        .sort({ archivedAt: -1, deletedAt: -1, updatedAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate('userId', 'displayName photoURL averageRating completedTrades location')
        .lean()

      const hasMore = items.length > limit
      if (hasMore) items.pop()
      const nextCursor = items.length > 0 ? items[items.length - 1]._id : null

      return res.json({
        ok: true,
        data: items.map(serializeClosetItem),
        nextCursor,
        hasMore,
      })
    }

    const query = { isDeleted: false }
    let requestedUserIds = null

    if (req.query.userId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: 'Invalid userId' })
      }
      requestedUserIds = [String(req.query.userId)]
    }

    const locationUserIds = await resolveLocationUserIds(
      req.query.city ? sanitizeInput(req.query.city) : '',
      req.query.region ? sanitizeInput(req.query.region) : ''
    )

    if (locationUserIds) {
      requestedUserIds = requestedUserIds
        ? requestedUserIds.filter((id) => locationUserIds.includes(String(id)))
        : locationUserIds
    }

    if (viewerId && requestedUserIds) {
      requestedUserIds = requestedUserIds.filter((id) => {
        if (id === viewerId) return true
        return !blockedUserIds.includes(String(id))
      })
    }

    const isOwnProfileQuery =
      viewerId &&
      Array.isArray(requestedUserIds) &&
      requestedUserIds.length === 1 &&
      requestedUserIds[0] === viewerId

    if (requestedUserIds) {
      if (requestedUserIds.length === 0) {
        return res.json({ ok: true, data: [], nextCursor: null, hasMore: false })
      }

      query.userId =
        requestedUserIds.length === 1
          ? toObjectId(requestedUserIds[0])
          : { $in: requestedUserIds.map((id) => toObjectId(id)) }

      query.status = isOwnProfileQuery
        ? { $in: [...OWNER_ACTIVE_STATUSES, ...OWNER_DRAFT_STATUSES] }
        : 'available'
    } else {
      query.status = 'available'
      if (viewerId) {
        query.userId = {
          $nin: [req.dbUser._id, ...blockedUserIds.map((id) => toObjectId(id))],
        }
      }
    }

    const searchRegex = normalizeSearchRegex(req.query.search)
    if (searchRegex) {
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
      ]
    }

    const categoryFilter = normalizeExactFilter(req.query.category, 50)
    if (categoryFilter) query.category = categoryFilter

    const brandFilter = normalizeExactFilter(req.query.brand, 50)
    if (brandFilter) query.brand = brandFilter

    const sizeFilter = normalizeExactFilter(req.query.size, 20)
    if (sizeFilter) query.size = sizeFilter

    const conditionFilter = normalizeExactFilter(req.query.condition, 20)
    if (conditionFilter) query.condition = conditionFilter

    const listingTypeFilter = normalizeExactFilter(req.query.listingType, 20)
    if (listingTypeFilter) query.listingType = listingTypeFilter

    const minPrice = req.query.priceMin !== undefined ? Number(req.query.priceMin) : null
    const maxPrice = req.query.priceMax !== undefined ? Number(req.query.priceMax) : null
    const priceQuery = {}
    if (minPrice != null && Number.isFinite(minPrice) && minPrice >= 0) {
      priceQuery.$gte = minPrice
    }
    if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice >= 0) {
      priceQuery.$lte = maxPrice
    }
    if (Object.keys(priceQuery).length > 0) {
      query.price = priceQuery
      query.listingType = query.listingType || { $in: ['sell', 'both'] }
    }

    const idQuery = {}
    if (req.query.cursor) {
      if (!mongoose.Types.ObjectId.isValid(req.query.cursor)) {
        return res.status(400).json({ error: 'Invalid cursor' })
      }
      idQuery.$lt = toObjectId(req.query.cursor)
    }

    if (viewerId && hiddenItemIds.length > 0) {
      idQuery.$nin = hiddenItemIds.map((id) => toObjectId(id))
    }

    if (Object.keys(idQuery).length > 0) {
      query._id = idQuery
    }

    const items = await Item.find(query)
      .sort(isOwnProfileQuery ? { sortOrder: 1, updatedAt: -1, _id: -1 } : { _id: -1 })
      .limit(limit + 1)
      .populate('userId', 'displayName photoURL averageRating completedTrades location')
      .lean()

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null
    const data = req.dbUser ? await enrichItems(items, req.dbUser._id) : items

    res.json({ ok: true, data, nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/closet — grouped owner closet data for management surfaces
router.get('/closet', requireAuth, async (req, res) => {
  try {
    const data = await buildClosetPayload(req.dbUser._id)
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/closet/reorder — reorder items inside owner closet
router.put('/closet/reorder', requireAuth, async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds : []

    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' })
    }

    const normalizedIds = [...new Set(itemIds.map((itemId) => String(itemId)))]
    if (normalizedIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
      return res.status(400).json({ error: 'Invalid itemIds payload' })
    }

    const ownedItems = await Item.find({
      _id: { $in: normalizedIds.map((itemId) => toObjectId(itemId)) },
      userId: req.dbUser._id,
      isDeleted: false,
    })
      .select('_id')
      .lean()

    if (ownedItems.length !== normalizedIds.length) {
      return res.status(403).json({ error: 'All reordered items must belong to the current user' })
    }

    await Promise.all(
      normalizedIds.map((itemId, index) =>
        Item.findByIdAndUpdate(itemId, { sortOrder: index + 1 })
      )
    )

    const data = await buildClosetPayload(req.dbUser._id)
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/closet/bulk — bulk closet actions
router.put('/closet/bulk', requireAuth, async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds : []
    const action = String(req.body.action || '')
    const reason = String(req.body.reason || '')

    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' })
    }

    const normalizedIds = [...new Set(itemIds.map((itemId) => String(itemId)))]
    if (normalizedIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
      return res.status(400).json({ error: 'Invalid itemIds payload' })
    }

    const nextStatusByAction = {
      publish: 'available',
      draft: 'draft',
      available: 'available',
      unavailable: 'unavailable',
      archive: 'archived',
    }

    const ownedItems = await Item.find({
      _id: { $in: normalizedIds.map((itemId) => toObjectId(itemId)) },
      userId: req.dbUser._id,
    })

    if (ownedItems.length !== normalizedIds.length) {
      return res.status(403).json({ error: 'All selected items must belong to the current user' })
    }

    if (action === 'delete') {
      await cancelTradesForItemMutation({
        itemIds: normalizedIds,
        actorUser: req.dbUser,
        reason: 'item_deleted',
      })

      await Promise.all(
        ownedItems.map((item) =>
          Item.findByIdAndUpdate(item._id, {
            isDeleted: true,
            deletedAt: new Date(),
          })
        )
      )
    } else {
      const nextStatus = nextStatusByAction[action]
      if (!nextStatus) {
        return res.status(400).json({ error: 'Unsupported bulk action' })
      }

      for (const item of ownedItems) {
        const updates = buildManualStatusUpdate(item, nextStatus, reason)
        if (updates.error) {
          return res.status(400).json({ error: updates.error })
        }

        await Item.findByIdAndUpdate(item._id, updates)
      }
    }

    const data = await buildClosetPayload(req.dbUser._id)
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/:id — item details
router.get('/:id/images', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id).lean()
    if (!item || item.isDeleted) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (String(item.userId) !== String(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to view this item images payload' })
    }

    res.json({
      ok: true,
      data: {
        imageOriginal: item.images?.[0] || null,
        imageClean: item.imageClean || null,
        isDigitized: !!item.isDigitized,
        digitizedAt: item.digitizedAt || null,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/digitize', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item || item.isDeleted) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to digitize this item' })
    }

    const imageOriginal = item.images?.[0]
    if (!imageOriginal) {
      return res.status(400).json({ error: 'Item must have at least one original image' })
    }

    const formData = new FormData()
    formData.append('image_url', imageOriginal)

    const aiResponse = await fetch(`${AI_SERVER_URL}/remove-background`, {
      method: 'POST',
      body: formData,
    })

    if (!aiResponse.ok) {
      const message = await readErrorBody(aiResponse)
      return res.status(502).json({ error: message || 'AI background removal failed' })
    }

    const cleanBytes = Buffer.from(await aiResponse.arrayBuffer())
    const cleanKey = createItemCleanKey(item._id, imageOriginal)
    const uploadResult = await uploadBuffer({
      key: cleanKey,
      buffer: cleanBytes,
      contentType: 'image/png',
    })

    item.imageClean = uploadResult.url
    item.isDigitized = true
    item.digitizedAt = new Date()
    await item.save()

    generateEmbeddingAsync(item._id, uploadResult.url)

    res.json({ ok: true, data: serializeClosetItem(item.toObject()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', maybeAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
      .populate('userId', 'displayName photoURL averageRating completedTrades location')
      .lean()

    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    const viewerId = req.dbUser?._id?.toString()
    const ownerId =
      typeof item.userId === 'object' && item.userId?._id
        ? item.userId._id.toString()
        : String(item.userId)

    let shouldRecordView = false
    if (viewerId) {
      const [blockedUserIds, hiddenItemIds] = await Promise.all([
        getBlockedUserIds(req.dbUser._id),
        getHiddenItemIds(req.dbUser._id),
      ])

      if (viewerId !== ownerId && blockedUserIds.includes(ownerId)) {
        return res.status(404).json({ error: 'Item not found' })
      }

      if (viewerId !== ownerId && hiddenItemIds.includes(String(item._id))) {
        return res.status(404).json({ error: 'Item not found' })
      }

      shouldRecordView = viewerId !== ownerId
    }

    if (viewerId !== ownerId && (item.isDeleted || item.status !== 'available')) {
      return res.status(410).json({
        error: 'Item is no longer available',
        data: {
          _id: item._id,
          title: item.title,
          status: item.isDeleted ? 'archived' : item.status,
          category: item.category,
          primaryImage: getPrimaryImage(item),
        },
      })
    }

    if (shouldRecordView) {
      await recordItemView(req.dbUser._id, item._id)
    }

    const enriched = await enrichItems(item, req.dbUser?._id || null)
    res.json({ ok: true, data: enriched })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items — create a new item
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      brand,
      size,
      condition,
      images,
      listingType,
      price,
      tradeFor,
      status,
    } = req.body

    const requestedStatus = status === 'draft' ? 'draft' : 'available'
    const validConditions = ['new', 'like_new', 'good', 'fair']
    const resolvedCondition = validConditions.includes(condition) ? condition : 'good'

    if (requestedStatus !== 'draft') {
      if (!title || typeof title !== 'string' || !category || typeof category !== 'string' || !condition || typeof condition !== 'string') {
        return res.status(400).json({ error: 'title, category, and condition are required (strings)' })
      }

      if (!validConditions.includes(condition)) {
        return res.status(400).json({ error: `condition must be one of: ${validConditions.join(', ')}` })
      }
    }

    const validListingTypes = ['sell', 'trade', 'both']
    const resolvedListingType = listingType || 'trade'
    if (!validListingTypes.includes(resolvedListingType)) {
      return res.status(400).json({ error: `listingType must be one of: ${validListingTypes.join(', ')}` })
    }

    let resolvedPrice
    if (resolvedListingType === 'sell' || resolvedListingType === 'both') {
      if (price !== undefined) {
        const parsedPrice = Number(price)
        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({ error: 'price must be a non-negative number' })
        }
        resolvedPrice = parsedPrice
      }
    }

    let resolvedTradeFor
    if (resolvedListingType === 'trade' || resolvedListingType === 'both') {
      if (tradeFor !== undefined) {
        resolvedTradeFor = String(tradeFor).slice(0, 200)
      }
    }

    const imageList = Array.isArray(images) ? images.filter((u) => typeof u === 'string').slice(0, 5) : []
    const sortOrder = await getNextSortOrder(req.dbUser._id)

    const itemData = {
      userId: req.dbUser._id,
      title: String(title || 'Untitled draft').slice(0, 100),
      description: String(description || '').slice(0, 500),
      category: String(category || 'Unsorted').slice(0, 50),
      brand: String(brand || '').slice(0, 50),
      size: String(size || '').slice(0, 20),
      condition: resolvedCondition,
      images: imageList,
      imageClean: null,
      isDigitized: false,
      digitizedAt: null,
      listingType: resolvedListingType,
      status: requestedStatus,
      sortOrder,
    }

    if (resolvedPrice !== undefined) itemData.price = resolvedPrice
    if (resolvedTradeFor !== undefined) itemData.tradeFor = resolvedTradeFor

    const item = await Item.create(itemData)

    if (item.images.length > 0) {
      generateEmbeddingAsync(item._id, item.images[0])
    }

    res.status(201).json({ ok: true, data: withPrimaryImage(item.toObject()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items/:id/hide — hide item from discovery surfaces
router.post('/:id/hide', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false }).lean()
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (String(item.userId) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot hide your own item' })
    }

    await HiddenItem.findOneAndUpdate(
      { userId: req.dbUser._id, itemId: req.params.id },
      {
        userId: req.dbUser._id,
        itemId: req.params.id,
        reason: String(req.body.reason || 'not_interested').slice(0, 100),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ ok: true, message: 'Item hidden from your discovery feed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:id/hide — undo hidden item
router.delete('/:id/hide', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    await HiddenItem.deleteOne({ userId: req.dbUser._id, itemId: req.params.id })
    res.json({ ok: true, message: 'Item restored to discovery surfaces' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items/:id/report — report an item
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false }).lean()
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (String(item.userId) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'You cannot report your own item' })
    }

    const reason = String(req.body.reason || '').trim().slice(0, 100)
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' })
    }

    const report = await Report.create({
      reporterId: req.dbUser._id,
      targetType: 'item',
      itemId: item._id,
      targetUserId: item.userId,
      reason,
      details: String(req.body.details || '').trim().slice(0, 500),
    })

    res.status(201).json({ ok: true, data: report })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/:id/similar — visually similar items
router.get('/:id/similar', maybeAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id).lean()
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.embedding || item.embedding.length === 0) {
      return res.json({ ok: true, data: [] })
    }

    const normalizedEmbedding = Array.isArray(item.embedding)
      ? item.embedding.map((value) => Number(value))
      : []

    if (normalizedEmbedding.length === 0 || normalizedEmbedding.some((value) => !Number.isFinite(value))) {
      console.warn(`[Items] Similar fallback for item=${req.params.id}: invalid embedding payload`)
      return res.json({ ok: true, data: [] })
    }

    const topK = Math.min(parseInt(req.query.limit) || 10, 20)
    let result = { results: [] }

    try {
      const response = await fetch(`${AI_SERVER_URL}/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedding: normalizedEmbedding, top_k: topK, exclude_id: req.params.id }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        console.warn(
          `[Items] Similar fallback for item=${req.params.id}: AI server responded ${response.status}${errorBody ? ` ${errorBody.slice(0, 200)}` : ''}`
        )
        return res.json({ ok: true, data: [] })
      }

      result = await response.json()
    } catch (error) {
      console.warn(`[Items] Similar fallback for item=${req.params.id}: ${error.message}`)
      return res.json({ ok: true, data: [] })
    }

    const similarIds = (result.results || []).map((entry) => entry.item_id).filter(Boolean)
    if (similarIds.length === 0) {
      return res.json({ ok: true, data: [] })
    }

    const viewerId = req.dbUser?._id?.toString() || null
    const [blockedUserIds, hiddenItemIds] = viewerId
      ? await Promise.all([
          getBlockedUserIds(req.dbUser._id),
          getHiddenItemIds(req.dbUser._id),
        ])
      : [[], []]

    const similarItems = await Item.find({
      _id: {
        $in: similarIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => toObjectId(id)),
        ...(viewerId && hiddenItemIds.length > 0
          ? { $nin: hiddenItemIds.map((id) => toObjectId(id)) }
          : {}),
      },
      status: 'available',
      isDeleted: false,
      ...(viewerId
        ? { userId: { $nin: [req.dbUser._id, ...blockedUserIds.map((id) => toObjectId(id))] } }
        : {}),
    })
      .populate('userId', 'displayName photoURL averageRating completedTrades location')
      .lean()

    const sortedItems = sortItemsByRequestedIds(similarItems, similarIds)
    const data = req.dbUser
      ? await enrichItems(sortedItems, req.dbUser._id)
      : sortedItems.map((entry) => withPrimaryImage(entry))

    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/:id — edit item (owner only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to edit this item' })
    }

    const allowed = { title: 100, description: 500, category: 50, brand: 50, size: 20 }
    const updates = {}

    for (const [key, maxLen] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        updates[key] = String(req.body[key]).slice(0, maxLen)
      }
    }

    if (req.body.images !== undefined) {
      updates.images = Array.isArray(req.body.images)
        ? req.body.images.filter((u) => typeof u === 'string').slice(0, 5)
        : []
      updates.imageClean = null
      updates.isDigitized = false
      updates.digitizedAt = null
    }

    if (req.body.condition !== undefined) {
      const validConditions = ['new', 'like_new', 'good', 'fair']
      if (!validConditions.includes(req.body.condition)) {
        return res.status(400).json({ error: `condition must be one of: ${validConditions.join(', ')}` })
      }
      updates.condition = req.body.condition
    }

    if (req.body.listingType !== undefined) {
      const validListingTypes = ['sell', 'trade', 'both']
      if (!validListingTypes.includes(req.body.listingType)) {
        return res.status(400).json({ error: `listingType must be one of: ${validListingTypes.join(', ')}` })
      }
      updates.listingType = req.body.listingType
    }

    const effectiveListingType = updates.listingType || item.listingType

    if (req.body.price !== undefined) {
      if (effectiveListingType === 'sell' || effectiveListingType === 'both') {
        const parsedPrice = Number(req.body.price)
        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({ error: 'price must be a non-negative number' })
        }
        updates.price = parsedPrice
      }
    }

    if (req.body.tradeFor !== undefined) {
      if (effectiveListingType === 'trade' || effectiveListingType === 'both') {
        updates.tradeFor = String(req.body.tradeFor).slice(0, 200)
      }
    }

    const previousFirstImage = item.images?.[0] || ''
    const updated = await Item.findByIdAndUpdate(req.params.id, updates, { new: true })

    if (updated?.images?.[0] && updated.images[0] !== previousFirstImage) {
      generateEmbeddingAsync(updated._id, updated.images[0])
    }

    res.json({ ok: true, data: withPrimaryImage(updated.toObject()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/:id/status - move item through manual closet states
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to update this item' })
    }

    const nextStatus = String(req.body.status || '')
    const updates = buildManualStatusUpdate(item, nextStatus, req.body.reason)
    if (updates.error) {
      return res.status(400).json({ error: updates.error })
    }

    const updated = await Item.findByIdAndUpdate(req.params.id, updates, { new: true })
    res.json({ ok: true, data: serializeClosetItem(updated.toObject()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/:id/sold - mark item as sold (owner only)
router.put('/:id/sold', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to update this item' })
    }

    if (item.isDeleted) {
      return res.status(400).json({ error: 'Item is deleted' })
    }

    if (item.status === 'pending_trade') {
      return res.status(400).json({ error: 'Item is in active trade flow and cannot be marked sold yet' })
    }

    if (['sold', 'swapped', 'traded'].includes(item.status)) {
      return res.json({ ok: true, data: serializeClosetItem(item.toObject()) })
    }

    const updated = await Item.findByIdAndUpdate(
      req.params.id,
      {
        status: 'sold',
        archivedAt: new Date(),
        archivedReason: 'sold',
        unavailableReason: '',
      },
      { new: true }
    )

    res.json({ ok: true, data: serializeClosetItem(updated.toObject()) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:id — soft delete (owner only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to delete this item' })
    }

    await cancelTradesForItemMutation({
      itemIds: [item._id],
      actorUser: req.dbUser,
      reason: 'item_deleted',
    })

    await Item.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedAt: new Date(),
    })

    res.json({ ok: true, message: 'Item deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
