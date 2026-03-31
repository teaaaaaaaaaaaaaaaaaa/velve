const mongoose = require('mongoose')

const chatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    lastMessageAt: { type: Date }, // Track last message time for sorting
  },
  { timestamps: true }
)

// Index for fetching user's chats sorted by recent activity
chatSchema.index({ participants: 1, updatedAt: -1 })

module.exports = mongoose.model('Chat', chatSchema)
