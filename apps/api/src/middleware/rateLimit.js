const rateLimit = require('express-rate-limit')

// Global API guard. Mobile sessions legitimately fan out across feed, profile,
// notifications, and VTO surfaces, so keep abuse protection without punishing
// normal navigation.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'Too many requests, please try again later.' },
})

// Strict: 10 requests per 15 minutes (for auth-related routes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
})

// Upload: 20 uploads per 15 minutes
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later.' },
})

// Chat messages should be limited per authenticated user, not per IP. Multiple
// real users can sit behind the same carrier/NAT address on mobile networks.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.dbUser?._id || req.user?.uid || 'anonymous-chat-user'),
  message: { error: 'Too many messages, please slow down.' },
})

module.exports = { apiLimiter, authLimiter, uploadLimiter, messageLimiter }
