import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  type FirebaseAuthTypes,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth'

import client from '@/api/client'
import { auth, googleClientId, googleOAuthConfigError } from '@/config/firebase'

type AuthContextType = {
  currentUser: FirebaseAuthTypes.User | null
  dbUser: DbUser | null
  loading: boolean
  profileError: string | null
  googleSignInAvailable: boolean
  googleSignInUnavailableReason: string | null
  refreshDbUser: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<any>
  registerWithEmail: (email: string, password: string) => Promise<any>
  logout: () => Promise<void>
}

type DbUser = {
  _id: string
  firebaseUid: string
  email: string
  displayName: string
  photoURL: string
  bio?: string
  emailVerified?: boolean
  averageRating?: number
  completedTrades?: number
  onboardingCompleted: boolean
  stylePreferences: string[]
  favoriteBrands: string[]
  categories: string[]
  sizes: { clothing: string; shoes: string }
  location: { city: string; region: string }
  followersCount: number
  followingCount: number
  itemsCount: number
  joinedAt?: string
  responseRate?: number | null
  successfulSwaps?: number
  profileCompleteness?: number
  closetCounts?: { live: number; drafts: number; archive: number }
}

type GoogleSignInModule = {
  GoogleSignin: {
    configure: (options: { webClientId: string; scopes: string[] }) => void
    hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>
    signIn: () => Promise<
      | { type: 'success'; data: { idToken: string | null } }
      | { type: 'cancelled' }
    >
  }
  statusCodes?: {
    SIGN_IN_CANCELLED?: string
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

const GOOGLE_SIGNIN_UNAVAILABLE = 'GOOGLE_SIGNIN_UNAVAILABLE'
const NETWORK_ERROR = 'NETWORK_ERROR'
const OAUTH_FAILED = 'OAUTH_FAILED'
const USER_CANCELLED = 'USER_CANCELLED'

let cachedGoogleSignInModule: GoogleSignInModule | null | undefined
let hasConfiguredGoogleSignin = false

function getGoogleSignInSupport() {
  if (googleOAuthConfigError) {
    return {
      available: false,
      module: null,
      unavailableReason:
        'Google prijava nije konfigurirana. Proveri EXPO_PUBLIC_GOOGLE_CLIENT_ID.',
    }
  }

  if (cachedGoogleSignInModule === undefined) {
    try {
      cachedGoogleSignInModule = require('@react-native-google-signin/google-signin') as GoogleSignInModule
    } catch {
      console.warn(
        '[Google Auth] Native Google Sign-In module is unavailable in this binary. Rebuild the Android app or open a dev build.'
      )
      cachedGoogleSignInModule = null
    }
  }

  if (!cachedGoogleSignInModule) {
    return {
      available: false,
      module: null,
      unavailableReason:
        'Ova instalacija nema Google Sign-In native modul. Koristi email prijavu ili instaliraj novu build varijantu.',
    }
  }

  if (!hasConfiguredGoogleSignin) {
    cachedGoogleSignInModule.GoogleSignin.configure({
      webClientId: googleClientId,
      scopes: ['profile', 'email'],
    })
    hasConfiguredGoogleSignin = true
  }

  return {
    available: true,
    module: cachedGoogleSignInModule,
    unavailableReason: null,
  }
}

export function useAuthProvider() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null)
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const googleSignInSupport = getGoogleSignInSupport()

  async function loadDbUser(user: FirebaseAuthTypes.User) {
    console.log('[Auth] Loading dbUser for Firebase UID:', user.uid)
    setProfileError(null)

    try {
      const response = await client.get('/api/users/me')
      if (response.data.ok) {
        const fetchedDbUser = response.data.data

        // Validate Firebase UID matches MongoDB firebaseUid
        if (fetchedDbUser.firebaseUid !== user.uid) {
          console.error('[Auth] User mismatch detected!', {
            firebaseUid: user.uid,
            dbUserFirebaseUid: fetchedDbUser.firebaseUid,
          })
          await signOut(auth)
          setCurrentUser(null)
          setDbUser(null)
          setProfileError('USER_MISMATCH')
          return
        }

        setDbUser(fetchedDbUser)
        console.log('[Auth] dbUser loaded:', fetchedDbUser._id)
        return
      }

      console.error('[Auth] Unexpected /api/users/me response:', response.data)
      setDbUser(null)
      setProfileError('INVALID_PROFILE_RESPONSE')
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'UNKNOWN_PROFILE_ERROR'

      console.error('[Auth] Failed to fetch dbUser:', message)
      setDbUser(null)
      setProfileError(message)
    }
  }

  async function refreshDbUser() {
    const user = auth.currentUser
    if (!user) {
      console.log('[Auth] refreshDbUser skipped - no signed in user')
      return
    }

    setLoading(true)
    await loadDbUser(user)
    setLoading(false)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth] onAuthStateChanged:', user ? user.uid : 'signed-out')
      setCurrentUser(user)
      setLoading(true)

      if (user) {
        await loadDbUser(user)
      } else {
        setDbUser(null)
        setProfileError(null)
      }

      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signInWithGoogle() {
    if (!googleSignInSupport.available || !googleSignInSupport.module) {
      throw new Error(GOOGLE_SIGNIN_UNAVAILABLE)
    }

    try {
      await googleSignInSupport.module.GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      })

      const userInfo = await googleSignInSupport.module.GoogleSignin.signIn()

      if (userInfo.type !== 'success') {
        throw new Error(USER_CANCELLED)
      }

      const idToken = userInfo.data?.idToken
      if (!idToken) {
        throw new Error(OAUTH_FAILED)
      }

      const credential = GoogleAuthProvider.credential(idToken)
      await signInWithCredential(auth, credential)

      // onAuthStateChanged will automatically fetch dbUser
    } catch (error: any) {
      console.error('[Google Auth] Error:', error)

      if (
        error?.message === USER_CANCELLED ||
        error?.code === googleSignInSupport.module.statusCodes?.SIGN_IN_CANCELLED
      ) {
        throw new Error(USER_CANCELLED)
      }

      if (error?.message === GOOGLE_SIGNIN_UNAVAILABLE) {
        throw error
      }

      if (
        error?.message?.toLowerCase().includes('network') ||
        error?.code === 'auth/network-request-failed'
      ) {
        throw new Error(NETWORK_ERROR)
      }

      throw error
    }
  }

  async function signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    return signOut(auth)
  }

  return {
    currentUser,
    dbUser,
    loading,
    profileError,
    googleSignInAvailable: googleSignInSupport.available,
    googleSignInUnavailableReason: googleSignInSupport.unavailableReason,
    refreshDbUser,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    logout,
  }
}

export { AuthContext }

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
