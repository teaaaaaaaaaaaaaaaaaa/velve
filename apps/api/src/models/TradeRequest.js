const mongoose = require('mongoose')

const tradeRequestSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offeredItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    type: {
      type: String,
      enum: ['trade', 'buy'],
      default: 'trade',
    },
    offeredPrice: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'expired'],
      default: 'pending',
    },
    message: { type: String, default: '' },
    expiresAt: { type: Date },
    respondedAt: { type: Date },
    acceptedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['sender', 'receiver'] },
    cancelledReason: { type: String, maxlength: 200 },
    expiredAt: { type: Date },

    // Trade completion
    completedAt: { type: Date },
    completedBy: { type: String, enum: ['sender', 'receiver'] },

    // Sender rating (rating the receiver)
    senderRating: { type: Number, min: 1, max: 5 },
    senderReview: { type: String, maxlength: 300 },
    senderRatedAt: { type: Date },

    // Receiver rating (rating the sender)
    receiverRating: { type: Number, min: 1, max: 5 },
    receiverReview: { type: String, maxlength: 300 },
    receiverRatedAt: { type: Date },
  },
  { timestamps: true }
)

// Indexes for trade queries
tradeRequestSchema.index({ senderId: 1, createdAt: -1 })      // sent trades by user
tradeRequestSchema.index({ receiverId: 1, createdAt: -1 })    // received trades by user
tradeRequestSchema.index({ status: 1, expiresAt: 1 })
tradeRequestSchema.index({ offeredItemId: 1 })                // trades for specific item
tradeRequestSchema.index({ requestedItemId: 1 })              // trades requesting specific item
tradeRequestSchema.index({ completedAt: 1 })                  // completed trades

module.exports = mongoose.model('TradeRequest', tradeRequestSchema)
