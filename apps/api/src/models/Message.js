const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['text', 'trade', 'buy', 'trade_update', 'item'], default: 'text' },
  itemData: {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    itemTitle: String,
    itemImage: String,
  },
  tradeData: {
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    offeredItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    offeredItemTitle: String,
    offeredItemImage: String,
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requestedItemTitle: String,
    requestedItemImage: String,
  },
  buyData: {
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    requestedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    requestedItemTitle: String,
    requestedItemImage: String,
    offeredPrice: Number,
  },
  statusData: {
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    status: String,
    label: String,
  },
  readBy: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
})

// Index for fetching chat messages sorted by time
messageSchema.index({ chatId: 1, createdAt: -1 })
messageSchema.index({ chatId: 1, senderId: 1, 'readBy.userId': 1 })

module.exports = mongoose.model('Message', messageSchema)
