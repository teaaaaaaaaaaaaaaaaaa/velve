const mongoose = require('mongoose')

const outfitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: 120 },
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }],
    vtoImageUrl: { type: String, required: true },
    renderModel: { type: String, default: 'fashn-vton-1.5', maxlength: 80 },
    isChainRender: { type: Boolean, default: false },
    chainSteps: { type: Number, default: 1, min: 1, max: 4 },
    categoriesUsed: [{ type: String, maxlength: 40 }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

outfitSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Outfit', outfitSchema)
