const admin = require('firebase-admin')
const User = require('../models/User')
const { hasAdminRole, isBootstrapAdmin } = require('../lib/admin')

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
  console.log('[AuthMiddleware] Verifying Firebase token', {
    method: req.method,
    url: req.originalUrl,
    tokenLength: token?.length || 0,
  })
  const decoded = await admin.auth().verifyIdToken(token)
  console.log('[AuthMiddleware] Firebase token verified', {
    uid: decoded.uid,
    email: decoded.email || null,
    signInProvider: decoded.firebase?.sign_in_provider || null,
  })
  req.user = decoded

  let dbUser = await User.findOne({ firebaseUid: decoded.uid })
  const bootstrapRole = isBootstrapAdmin(decoded) ? 'admin' : null
  if (!dbUser) {
    const emailPrefix = (decoded.email || '').split('@')[0]
    dbUser = await User.create({
      firebaseUid: decoded.uid,
      email: decoded.email || '',
      role: bootstrapRole || 'user',
      displayName: decoded.name || emailPrefix || 'Korisnik',
      photoURL: decoded.picture || '',
    })
    console.log('[AuthMiddleware] Created MongoDB user', {
      uid: decoded.uid,
      dbUserId: dbUser._id,
      email: dbUser.email,
    })
  } else if (!dbUser.displayName) {
    const emailPrefix = (dbUser.email || '').split('@')[0]
    dbUser = await User.findByIdAndUpdate(
      dbUser._id,
      {
        displayName: emailPrefix || 'Korisnik',
        ...(bootstrapRole && dbUser.role !== 'admin' ? { role: bootstrapRole } : {}),
      },
      { new: true }
    )
  } else if (bootstrapRole && dbUser.role !== 'admin') {
    dbUser = await User.findByIdAndUpdate(dbUser._id, { role: bootstrapRole }, { new: true })
  }

  req.dbUser = dbUser
  console.log('[AuthMiddleware] Attached MongoDB user', {
    uid: decoded.uid,
    dbUserId: dbUser?._id || null,
    onboardingCompleted: dbUser?.onboardingCompleted || false,
  })
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
    if (req.dbUser?.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' })
    }
    next()
  } catch (err) {
    console.error(`[AuthMiddleware] Invalid token for ${req.method} ${req.originalUrl}:`, {
      message: err.message,
      code: err.code || err.errorInfo?.code || null,
    })
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

async function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!hasAdminRole(req.dbUser)) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  })
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

module.exports = { requireAdmin, requireAuth, maybeAuth }
