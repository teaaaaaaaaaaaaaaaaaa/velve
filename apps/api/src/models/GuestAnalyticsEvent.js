const mongoose = require('mongoose')

const GUEST_EVENT_TYPES = [
  'guest_feed_view',
  'guest_item_impression',
  'guest_item_open_attempt',
  'guest_like_attempt',
  'guest_wishlist_attempt',
  'guest_trade_attempt',
  'guest_search_attempt',
  'guest_nav_attempt',
  'guest_signup_wall_view',
  'guest_signup_cta_click',
]

const guestAnalyticsEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, enum: GUEST_EVENT_TYPES, required: true },
    sessionId: { type: String, required: true, maxlength: 120 },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    platform: { type: String, default: '', maxlength: 40 },
    route: { type: String, default: '', maxlength: 120 },
    metadata: { type: Object, default: {} },
    ipHash: { type: String, default: '', maxlength: 80 },
    userAgent: { type: String, default: '', maxlength: 240 },
  },
  { timestamps: true }
)

guestAnalyticsEventSchema.index({ eventType: 1, createdAt: -1 })
guestAnalyticsEventSchema.index({ sessionId: 1, createdAt: -1 })
guestAnalyticsEventSchema.index({ itemId: 1, createdAt: -1 })

module.exports = {
  GuestAnalyticsEvent: mongoose.model('GuestAnalyticsEvent', guestAnalyticsEventSchema),
  GUEST_EVENT_TYPES,
}
