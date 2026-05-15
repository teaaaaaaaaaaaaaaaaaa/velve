const express = require('express')
const mongoose = require('mongoose')
const { requireAdmin } = require('../middleware/auth')
const AdminAuditLog = require('../models/AdminAuditLog')
const Item = require('../models/Item')
const Report = require('../models/Report')
const User = require('../models/User')

const router = express.Router()
router.use(requireAdmin)

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
