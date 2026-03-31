const mongoose = require('mongoose')

const followSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

// Compound index for uniqueness
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true })

// Single-field indexes for query performance
followSchema.index({ followerId: 1 })   // get all users that follower follows
followSchema.index({ followingId: 1 })  // get all followers of a user

module.exports = mongoose.model('Follow', followSchema)
