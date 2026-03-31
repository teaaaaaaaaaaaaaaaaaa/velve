const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

// Index for fetching chat messages sorted by time
messageSchema.index({ chatId: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)
