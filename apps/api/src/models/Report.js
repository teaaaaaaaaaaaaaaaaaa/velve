const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['item', 'user'], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true, maxlength: 100 },
    details: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open' },
  },
  { timestamps: true }
)

reportSchema.index({ reporterId: 1, targetType: 1, itemId: 1 })
reportSchema.index({ reporterId: 1, targetType: 1, targetUserId: 1 })
reportSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
