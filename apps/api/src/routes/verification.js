const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const User = require('../models/User')
const EmailVerification = require('../models/EmailVerification')
const { sendVerificationEmail } = require('../lib/mailer')

// POST /api/verification/send-email — Send email verification link
router.post('/send-email', requireAuth, async (req, res) => {
  try {
    const user = req.dbUser

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' })
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Save verification token
    await EmailVerification.create({
      userId: user._id,
      email: user.email,
      token,
      expiresAt,
    })

    const verificationUrl = `${process.env.WEB_URL || 'https://velveapp.com'}/verify?token=${token}`

    try {
      await sendVerificationEmail({
        to: user.email,
        displayName: user.displayName,
        verificationUrl,
      })
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message)
      await EmailVerification.deleteOne({ token })
      return res.status(500).json({ error: 'Failed to send verification email' })
    }

    res.json({ ok: true, message: 'Verification email sent' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/verification/verify-email — Verify email with token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const verification = await EmailVerification.findOne({ token })

    if (!verification) {
      return res.status(404).json({ error: 'Invalid or expired token' })
    }

    if (verification.expiresAt < new Date()) {
      await EmailVerification.deleteOne({ token })
      return res.status(400).json({ error: 'Token has expired' })
    }

    // Mark email as verified
    await User.findByIdAndUpdate(verification.userId, { emailVerified: true })

    // Mark verification as completed
    verification.verifiedAt = new Date()
    await verification.save()

    res.json({ ok: true, message: 'Email verified successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
