const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

const chatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    messages: [messageSchema],
    tradeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeRequest' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Chat', chatSchema)
