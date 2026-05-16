const mongoose = require('mongoose')

const waitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: 'web',
      enum: ['web', 'app', 'referral', 'admin'],
    },
    referrer: String,
    ipAddress: String,
    userAgent: { type: String, maxlength: 512 },
    emailSentAt: Date,
    invitedAt: Date,
  },
  { timestamps: true }
)

module.exports = mongoose.model('Waitlist', waitlistSchema)
