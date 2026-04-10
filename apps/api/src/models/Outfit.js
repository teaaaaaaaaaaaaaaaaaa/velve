const mongoose = require('mongoose')

const outfitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: 120 },
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }],
    vtoImageUrl: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

outfitSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Outfit', outfitSchema)
