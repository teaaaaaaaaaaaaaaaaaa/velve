const mongoose = require('mongoose')

const likeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  },
  { timestamps: true }
)

likeSchema.index({ userId: 1, itemId: 1 }, { unique: true })

module.exports = mongoose.model('Like', likeSchema)
