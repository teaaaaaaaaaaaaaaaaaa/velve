const mongoose = require('mongoose')

const blockedUserSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: true }
)

blockedUserSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true })
blockedUserSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('BlockedUser', blockedUserSchema)
