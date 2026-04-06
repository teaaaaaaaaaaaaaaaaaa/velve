const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['text', 'trade', 'buy', 'trade_update'], default: 'text' },
  tradeData: {
    offeredItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    offeredItemTitle: String,
    offeredItemImage: String,
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requestedItemTitle: String,
    requestedItemImage: String,
  },
  buyData: {
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requestedItemTitle: String,
    requestedItemImage: String,
  },
  statusData: {
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    status: String,
    label: String,
  },
  createdAt: { type: Date, default: Date.now },
})

// Index for fetching chat messages sorted by time
messageSchema.index({ chatId: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)
