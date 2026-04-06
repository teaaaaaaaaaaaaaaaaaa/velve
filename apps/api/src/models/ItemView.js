const mongoose = require('mongoose')

const itemViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    viewCount: { type: Number, default: 1, min: 1 },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

itemViewSchema.index({ userId: 1, itemId: 1 }, { unique: true })
itemViewSchema.index({ userId: 1, lastViewedAt: -1 })

module.exports = mongoose.model('ItemView', itemViewSchema)
