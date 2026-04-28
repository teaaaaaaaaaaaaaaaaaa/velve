const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'item_like',
        'item_wishlist',
        'follow',
        'chat_message',
        'trade_request',
        'trade_update',
        'trade_complete',
        'trade_rating',
        'trade_cancelled',
        'trade_expired',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, readAt: 1 })

module.exports = mongoose.model('Notification', notificationSchema)
