const mongoose = require('mongoose')

const guestFeedSlotSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, unique: true },
    rank: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    curatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '', maxlength: 240 },
  },
  { timestamps: true }
)

guestFeedSlotSchema.index({ active: 1, rank: 1 })
guestFeedSlotSchema.index({ itemId: 1 }, { unique: true })

module.exports = mongoose.model('GuestFeedSlot', guestFeedSlotSchema)
