const mongoose = require('mongoose')

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  },
  { timestamps: true }
)

// Compound unique index - user can only wishlist an item once
wishlistSchema.index({ userId: 1, itemId: 1 }, { unique: true })

// Index for user's wishlist queries
wishlistSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Wishlist', wishlistSchema)
