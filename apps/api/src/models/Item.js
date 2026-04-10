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
    imageClean: { type: String, default: null },
    isDigitized: { type: Boolean, default: false },
    digitizedAt: { type: Date, default: null },
    embedding: [{ type: Number }],      // CLIP vektor (512 dim)
    engagementScore: { type: Number, default: 0 },  // Pre-computed feed ranking score
    lastScoreUpdate: { type: Date },    // When score was last calculated
    listingType: {
      type: String,
      enum: ['sell', 'trade', 'both'],
      default: 'trade',
    },
    price: { type: Number, min: 0 },               // Samo za sell/both
    tradeFor: { type: String, maxlength: 200 },    // Opis za šta želi da razmeni (trade/both)
    status: {
      type: String,
      enum: ['draft', 'available', 'pending_trade', 'traded', 'sold', 'unavailable', 'archived', 'swapped'],
      default: 'available',
    },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date },
    archivedReason: { type: String, maxlength: 80 },
    unavailableReason: { type: String, maxlength: 80 },
    isDeleted: { type: Boolean, default: false },   // Soft delete flag
    deletedAt: { type: Date },          // When item was deleted
  },
  { timestamps: true }
)

// Indexes for query performance
itemSchema.index({ userId: 1, createdAt: -1 })      // user's items sorted by date
itemSchema.index({ userId: 1, sortOrder: 1, createdAt: -1 })
itemSchema.index({ category: 1, createdAt: -1 })   // category filtering + sorting
itemSchema.index({ createdAt: -1 })                // general feed sorting
itemSchema.index({ engagementScore: -1 })          // feed ranking by score
itemSchema.index({ status: 1 })                    // filter by availability status
itemSchema.index({ isDeleted: 1 })                 // filter deleted items

module.exports = mongoose.model('Item', itemSchema)
