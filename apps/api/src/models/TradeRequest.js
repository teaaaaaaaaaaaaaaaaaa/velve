const mongoose = require('mongoose')

const tradeRequestSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offeredItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    message: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('TradeRequest', tradeRequestSchema)
