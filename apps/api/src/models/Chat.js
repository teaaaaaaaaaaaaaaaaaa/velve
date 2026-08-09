const mongoose = require('mongoose')

const chatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    lastMessageAt: { type: Date }, // Track last message time for sorting
    lastMessageText: { type: String, default: '' },
    lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// Index for fetching user's chats sorted by recent activity
chatSchema.index({ participants: 1, lastMessageAt: -1, updatedAt: -1 })
// NOTE: never add a compound index over two array fields (e.g. participants +
// deletedFor) — MongoDB rejects every insert with "cannot index parallel arrays".

module.exports = mongoose.model('Chat', chatSchema)
