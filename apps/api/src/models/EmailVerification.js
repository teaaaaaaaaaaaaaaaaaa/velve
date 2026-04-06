const mongoose = require('mongoose')

const emailVerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
)

// `unique: true` on `token` already creates the lookup index.
emailVerificationSchema.index({ userId: 1 })

// TTL index to auto-delete expired tokens
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('EmailVerification', emailVerificationSchema)
