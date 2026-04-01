const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String, default: '' },
    photoURL: { type: String, default: '' },
    bio: { type: String, default: '' },
    expoPushToken: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    phone: { type: String, default: '' },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    completedTrades: { type: Number, default: 0 },

    // Onboarding fields
    onboardingCompleted: { type: Boolean, default: false },
    stylePreferences: { type: [String], default: [] },
    favoriteBrands: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    sizes: {
      clothing: { type: String, default: '' },
      shoes: { type: String, default: '' },
    },
    location: {
      city: { type: String, default: '' },
      region: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

// Indexes
userSchema.index({ email: 1 })
userSchema.index({ averageRating: -1 }) // For sorting by rating
userSchema.index({ phone: 1 })

module.exports = mongoose.model('User', userSchema)
