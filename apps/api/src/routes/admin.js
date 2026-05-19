const express = require('express')
const mongoose = require('mongoose')
const { requireAdmin } = require('../middleware/auth')
const { adminLimiter } = require('../middleware/rateLimit')
const AdminAuditLog = require('../models/AdminAuditLog')
const GuestFeedSlot = require('../models/GuestFeedSlot')
const {
  GuestAnalyticsEvent,
  GUEST_EVENT_TYPES,
} = require('../models/GuestAnalyticsEvent')
const Item = require('../models/Item')
const Report = require('../models/Report')
const User = require('../models/User')

const router = express.Router()
router.use(requireAdmin)
router.use(adminLimiter)

async function writeAudit(req, action, targetType, targetId, details = {}) {
  return AdminAuditLog.create({
    actorUserId: req.dbUser._id,
    action,
    targetType,
    targetId: mongoose.Types.ObjectId.isValid(String(targetId)) ? targetId : undefined,
    details,
  }).catch((err) => {
    console.warn('[AdminAudit] create failed:', err.message)
  })
}

function normalizeSearch(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return null
  return new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id))
}

function buildItemHealth(item) {
  if (!item) return 'missing'
  if (item.isDeleted) return 'deleted'
  if (item.status !== 'available') return item.status || 'unavailable'
  return 'available'
}

function serializeAdminItem(item, selectedIds = new Set()) {
  if (!item) return null
  const owner = item.userId && typeof item.userId === 'object' ? item.userId : null

  return {
    _id: item._id,
    title: item.title,
    brand: item.brand,
    category: item.category,
    size: item.size,
    status: item.status,
    isDeleted: !!item.isDeleted,
    health: buildItemHealth(item),
    primaryImage: item.imageClean || item.primaryImage || item.images?.[0] || null,
    owner: owner
      ? {
          _id: owner._id,
          displayName: owner.displayName,
          email: owner.email,
          photoURL: owner.photoURL,
        }
      : null,
    selected: selectedIds.has(String(item._id)),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function serializeGuestSlot(slot) {
  const item = slot.itemId && typeof slot.itemId === 'object' ? slot.itemId : null
  return {
    _id: slot._id,
    rank: slot.rank,
    active: slot.active,
    note: slot.note || '',
    itemId: item?._id || slot.itemId || null,
    item: serializeAdminItem(item),
    health: buildItemHealth(item),
    curatedAt: slot.updatedAt || slot.createdAt,
  }
}

router.get('/me', async (req, res) => {
  res.json({
    ok: true,
    data: {
      _id: req.dbUser._id,
      email: req.dbUser.email,
      displayName: req.dbUser.displayName,
      role: req.dbUser.role,
    },
  })
})

router.get('/guest-feed', async (_req, res) => {
  try {
    const slots = await GuestFeedSlot.find({})
      .sort({ rank: 1, createdAt: 1 })
      .populate({
        path: 'itemId',
        populate: {
          path: 'userId',
          select: 'displayName email photoURL',
        },
      })
      .lean()

    res.json({ ok: true, data: slots.map(serializeGuestSlot) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/guest-feed/candidates', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100)
    const searchRegex = normalizeSearch(req.query.search)
    const query = {
      isDeleted: false,
      status: 'available',
    }

    if (searchRegex) {
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
      ]
    }

    const [slots, items] = await Promise.all([
      GuestFeedSlot.find({ active: true }).select('itemId').lean(),
      Item.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate('userId', 'displayName email photoURL')
        .lean(),
    ])

    const selectedIds = new Set(slots.map((slot) => String(slot.itemId)))
    res.json({ ok: true, data: items.map((item) => serializeAdminItem(item, selectedIds)) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/guest-feed', async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds : []
    const normalizedIds = [...new Set(itemIds.map((itemId) => String(itemId).trim()).filter(Boolean))]

    if (normalizedIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' })
    }

    if (normalizedIds.length > 100) {
      return res.status(400).json({ error: 'Guest feed can contain up to 100 curated items' })
    }

    if (normalizedIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
      return res.status(400).json({ error: 'Invalid itemIds payload' })
    }

    const availableItems = await Item.find({
      _id: { $in: normalizedIds.map(toObjectId) },
      isDeleted: false,
      status: 'available',
    })
      .select('_id')
      .lean()

    const availableIds = new Set(availableItems.map((item) => String(item._id)))
    const unavailableIds = normalizedIds.filter((itemId) => !availableIds.has(itemId))
    if (unavailableIds.length > 0) {
      return res.status(400).json({
        error: 'Only available, non-deleted items can be added to guest feed',
        unavailableIds,
      })
    }

    await GuestFeedSlot.deleteMany({})
    await GuestFeedSlot.insertMany(
      normalizedIds.map((itemId, index) => ({
        itemId: toObjectId(itemId),
        rank: index + 1,
        active: true,
        curatedBy: req.dbUser._id,
      }))
    )

    await writeAudit(req, 'guest_feed_updated', 'guest_feed', undefined, {
      count: normalizedIds.length,
      visibleToGuests: Math.min(normalizedIds.length, 20),
      itemIds: normalizedIds,
    })

    const slots = await GuestFeedSlot.find({})
      .sort({ rank: 1, createdAt: 1 })
      .populate({
        path: 'itemId',
        populate: {
          path: 'userId',
          select: 'displayName email photoURL',
        },
      })
      .lean()

    res.json({ ok: true, data: slots.map(serializeGuestSlot) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/guest-analytics/summary', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const match = { createdAt: { $gte: since } }

    const [counts, uniqueSessions, topItems, recent] = await Promise.all([
      GuestAnalyticsEvent.aggregate([
        { $match: match },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      GuestAnalyticsEvent.distinct('sessionId', match),
      GuestAnalyticsEvent.aggregate([
        {
          $match: {
            ...match,
            itemId: { $exists: true },
            eventType: {
              $in: [
                'guest_item_impression',
                'guest_item_open_attempt',
                'guest_like_attempt',
                'guest_wishlist_attempt',
                'guest_trade_attempt',
              ],
            },
          },
        },
        { $group: { _id: '$itemId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      GuestAnalyticsEvent.find(match)
        .sort({ createdAt: -1 })
        .limit(30)
        .select('eventType sessionId itemId platform route metadata createdAt')
        .lean(),
    ])

    const itemIds = topItems.map((entry) => entry._id).filter(Boolean)
    const items = await Item.find({ _id: { $in: itemIds } })
      .populate('userId', 'displayName email photoURL')
      .lean()
    const itemMap = new Map(items.map((item) => [String(item._id), serializeAdminItem(item)]))

    res.json({
      ok: true,
      data: {
        days,
        since,
        eventTypes: GUEST_EVENT_TYPES,
        counts: Object.fromEntries(counts.map((entry) => [entry._id, entry.count])),
        sessions: uniqueSessions.length,
        topItems: topItems.map((entry) => ({
          itemId: entry._id,
          count: entry.count,
          item: itemMap.get(String(entry._id)) || null,
        })),
        recent,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/audit-log', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
    const logs = await AdminAuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorUserId', 'displayName email photoURL')
      .lean()

    res.json({ ok: true, data: logs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
    const status = String(req.query.status || 'open')
    const query = status === 'all' ? {} : { status }

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('reporterId', 'displayName email photoURL')
      .populate('targetUserId', 'displayName email photoURL accountStatus')
      .populate('itemId', 'title images imageClean status userId')
      .lean()

    res.json({ ok: true, data: reports })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/reports/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid report ID' })
    }

    const status = String(req.body.status || '')
    if (!['open', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'status must be open, reviewed, or resolved' })
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean()

    if (!report) return res.status(404).json({ error: 'Report not found' })
    await writeAudit(req, 'report_status_updated', 'report', report._id, { status })
    res.json({ ok: true, data: report })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/items/:id/hide', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      {
        status: 'archived',
        archivedAt: new Date(),
        archivedReason: String(req.body.reason || 'admin_hide').slice(0, 80),
      },
      { new: true }
    ).lean()

    if (!item) return res.status(404).json({ error: 'Item not found' })
    await writeAudit(req, 'item_hidden', 'item', item._id, { reason: item.archivedReason })
    res.json({ ok: true, data: item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/suspend', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }
    if (String(req.params.id) === String(req.dbUser._id)) {
      return res.status(400).json({ error: 'Admins cannot suspend themselves' })
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        accountStatus: 'suspended',
        suspendedAt: new Date(),
        suspendedReason: String(req.body.reason || '').slice(0, 300),
      },
      { new: true }
    )
      .select('-expoPushToken')
      .lean()

    if (!user) return res.status(404).json({ error: 'User not found' })
    await writeAudit(req, 'user_suspended', 'user', user._id, { reason: user.suspendedReason })
    res.json({ ok: true, data: user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/activate', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        accountStatus: 'active',
        $unset: { suspendedAt: 1, suspendedReason: 1 },
      },
      { new: true }
    )
      .select('-expoPushToken')
      .lean()

    if (!user) return res.status(404).json({ error: 'User not found' })
    await writeAudit(req, 'user_activated', 'user', user._id)
    res.json({ ok: true, data: user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
