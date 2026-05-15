const mongoose = require('mongoose')

const adminAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 120 },
    targetType: { type: String, enum: ['item', 'user', 'report', 'system'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: Object, default: {} },
  },
  { timestamps: true }
)

adminAuditLogSchema.index({ actorUserId: 1, createdAt: -1 })
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema)
