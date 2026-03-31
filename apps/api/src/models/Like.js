const mongoose = require('mongoose')

const likeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  },
  { timestamps: true }
)

// Compound index for uniqueness
likeSchema.index({ userId: 1, itemId: 1 }, { unique: true })

// Single-field indexes for query performance
likeSchema.index({ userId: 1 })   // get all items liked by user
likeSchema.index({ itemId: 1 })   // get all likes for an item

module.exports = mongoose.model('Like', likeSchema)
