const express = require('express')
const rateLimit = require('express-rate-limit')
const Waitlist = require('../models/Waitlist')
const { sendWaitlistConfirmation } = require('../lib/mailer')

const router = express.Router()

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Strict per-IP limit so the public form can't be abused.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
})

// POST /api/waitlist/signup  { email }
router.post('/signup', signupLimiter, async (req, res) => {
  const rawEmail = (req.body?.email || '').toString().trim().toLowerCase()

  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RX.test(rawEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  try {
    // Already on the list — return their position, no duplicate email
    const existing = await Waitlist.findOne({ email: rawEmail })
    if (existing) {
      return res.status(200).json({
        ok: true,
        position: existing.position,
        alreadyOnList: true,
      })
    }

    // Position = current count + 1 (monotonic, never reused)
    const count = await Waitlist.countDocuments()
    const position = count + 1

    const entry = await Waitlist.create({
      email: rawEmail,
      position,
      source: 'web',
      referrer: req.get('referer') || undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    })

    // Fire-and-forget email. Don't block the signup response on SMTP.
    sendWaitlistConfirmation({ to: rawEmail, position })
      .then(async () => {
        await Waitlist.updateOne({ _id: entry._id }, { emailSentAt: new Date() }).catch(() => {})
      })
      .catch((err) => {
        console.error('[waitlist] send confirmation failed:', err.message)
      })

    return res.json({ ok: true, position })
  } catch (err) {
    // Duplicate key race — fetch the row that won the race
    if (err && err.code === 11000) {
      const existing = await Waitlist.findOne({ email: rawEmail }).catch(() => null)
      return res.json({ ok: true, position: existing?.position || 0, alreadyOnList: true })
    }
    console.error('[waitlist] signup error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

// GET /api/waitlist/count  — public live counter
router.get('/count', async (_req, res) => {
  try {
    const count = await Waitlist.countDocuments()
    return res.json({ count })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
