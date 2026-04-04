const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const User = require('../models/User')
const EmailVerification = require('../models/EmailVerification')

// In-memory storage for SMS OTP codes (replace with Redis in production)
const otpStore = new Map()

// Email configuration (use environment variables in production)
const nodemailer = require('nodemailer')

// Configure email transporter (using Gmail as example - replace with SendGrid/SES in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

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

    // Send verification email
    const verificationUrl = `${process.env.WEB_URL || 'https://velve.app'}/verify?token=${token}`

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Velve" <noreply@velve.app>',
        to: user.email,
        subject: 'Verify your Velve email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify your email address</h2>
            <p>Hi ${user.displayName || 'there'},</p>
            <p>Click the button below to verify your email address:</p>
            <a href="${verificationUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #431A43; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
              Verify Email
            </a>
            <p>Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
            <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message)
      // Delete the verification token if email fails
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

// POST /api/verification/send-sms — Send SMS OTP (placeholder - requires Twilio setup)
router.post('/send-sms', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Valid phone number is required' })
    }

    if (req.dbUser.phoneVerified) {
      return res.status(400).json({ error: 'Phone already verified' })
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Store code in memory (expires in 10 minutes)
    otpStore.set(phone, {
      code,
      userId: req.dbUser._id.toString(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    // Clean up expired codes periodically
    setTimeout(() => {
      const stored = otpStore.get(phone)
      if (stored && stored.expiresAt < Date.now()) {
        otpStore.delete(phone)
      }
    }, 10 * 60 * 1000)

    // TODO: Send SMS via Twilio
    // const twilio = require('twilio')(accountSid, authToken)
    // await twilio.messages.create({
    //   body: `Your Velve verification code is: ${code}`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone,
    // })

    // For development, log the code
    console.log(`[SMS OTP] Phone: ${phone}, Code: ${code}`)

    res.json({ ok: true, message: 'Verification code sent', devCode: process.env.NODE_ENV === 'development' ? code : undefined })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/verification/verify-phone — Verify phone with OTP
router.post('/verify-phone', requireAuth, async (req, res) => {
  try {
    const { phone, code } = req.body

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' })
    }

    const stored = otpStore.get(phone)

    if (!stored) {
      return res.status(404).json({ error: 'No verification code found for this phone' })
    }

    if (stored.expiresAt < Date.now()) {
      otpStore.delete(phone)
      return res.status(400).json({ error: 'Verification code has expired' })
    }

    if (stored.userId !== req.dbUser._id.toString()) {
      return res.status(403).json({ error: 'Code does not match user' })
    }

    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    // Mark phone as verified
    await User.findByIdAndUpdate(req.dbUser._id, {
      phoneVerified: true,
      phone,
    })

    // Remove used code
    otpStore.delete(phone)

    res.json({ ok: true, message: 'Phone verified successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
