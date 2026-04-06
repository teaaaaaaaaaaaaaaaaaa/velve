const admin = require('firebase-admin')
const User = require('../models/User')

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  })
}

/**
 * Middleware: verifikuje Firebase ID token iz Authorization headera.
 * Attachuje dekodovani token na req.user.
 * Auto-kreira MongoDB User dokument pri prvom loginu (ensureUser).
 * Attachuje MongoDB user na req.dbUser.
 */
async function attachUserFromToken(token, req) {
  const decoded = await admin.auth().verifyIdToken(token)
  console.log(`[AuthMiddleware] Firebase token verified for uid=${decoded.uid}`)
  req.user = decoded

  let dbUser = await User.findOne({ firebaseUid: decoded.uid })
  if (!dbUser) {
    const emailPrefix = (decoded.email || '').split('@')[0]
    dbUser = await User.create({
      firebaseUid: decoded.uid,
      email: decoded.email || '',
      displayName: decoded.name || emailPrefix || 'Korisnik',
      photoURL: decoded.picture || '',
    })
    console.log(`[AuthMiddleware] Created MongoDB user for uid=${decoded.uid}`)
  } else if (!dbUser.displayName) {
    const emailPrefix = (dbUser.email || '').split('@')[0]
    dbUser = await User.findByIdAndUpdate(
      dbUser._id,
      { displayName: emailPrefix || 'Korisnik' },
      { new: true }
    )
  }

  req.dbUser = dbUser
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn(`[AuthMiddleware] Missing bearer token for ${req.method} ${req.originalUrl}`)
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    await attachUserFromToken(token, req)
    next()
  } catch (err) {
    console.error(`[AuthMiddleware] Invalid token for ${req.method} ${req.originalUrl}:`, err.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

async function maybeAuth(req, _res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    await attachUserFromToken(token, req)
  } catch (err) {
    console.warn(`[AuthMiddleware] Optional auth skipped for ${req.method} ${req.originalUrl}:`, err.message)
  }

  next()
}

module.exports = { requireAuth, maybeAuth }
