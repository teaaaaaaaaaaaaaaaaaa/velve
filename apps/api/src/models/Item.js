const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    brand: { type: String, default: '' },
    size: { type: String, default: '' },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair'],
      required: true,
    },
    images: [{ type: String }],         // Cloudflare R2 URL-ovi
    embedding: [{ type: Number }],      // CLIP vektor (512 dim)
  },
  { timestamps: true }
)

module.exports = mongoose.model('Item', itemSchema)
