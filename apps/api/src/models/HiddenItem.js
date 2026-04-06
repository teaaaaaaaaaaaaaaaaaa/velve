const mongoose = require('mongoose')

const hiddenItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    reason: { type: String, default: 'not_interested', maxlength: 100 },
  },
  { timestamps: true }
)

hiddenItemSchema.index({ userId: 1, itemId: 1 }, { unique: true })
hiddenItemSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('HiddenItem', hiddenItemSchema)
