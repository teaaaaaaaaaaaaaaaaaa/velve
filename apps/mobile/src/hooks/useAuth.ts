import { createContext, useContext, useState, useEffect } from 'react'
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import client from '@/api/client'

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  scopes: ['profile', 'email'],
})

type AuthContextType = {
  currentUser: FirebaseAuthTypes.User | null
  dbUser: DbUser | null
  loading: boolean
  profileError: string | null
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

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthProvider() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null)
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

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
          await auth().signOut()
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
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'UNKNOWN_PROFILE_ERROR'

      console.error('[Auth] Failed to fetch dbUser:', message)
      setDbUser(null)
      setProfileError(message)
    }
  }

  async function refreshDbUser() {
    const user = auth().currentUser
    if (!user) {
      console.log('[Auth] refreshDbUser skipped - no signed in user')
      return
    }

    setLoading(true)
    await loadDbUser(user)
    setLoading(false)
  }

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
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
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const userInfo = await GoogleSignin.signIn()
      const idToken = userInfo.data?.idToken

      if (!idToken) {
        throw new Error('OAUTH_FAILED: No ID token received')
      }

      const credential = auth.GoogleAuthProvider.credential(idToken)
      await auth().signInWithCredential(credential)

      // onAuthStateChanged will automatically fetch dbUser
    } catch (error: any) {
      console.error('[Google Auth] Error:', error)

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('USER_CANCELLED')
      }

      if (error.message?.toLowerCase().includes('network') || error.code === 'auth/network-request-failed') {
        throw new Error('NETWORK_ERROR')
      }

      throw error
    }
  }

  async function signInWithEmail(email: string, password: string) {
    return auth().signInWithEmailAndPassword(email, password)
  }

  async function registerWithEmail(email: string, password: string) {
    return auth().createUserWithEmailAndPassword(email, password)
  }

  async function logout() {
    return auth().signOut()
  }

  return {
    currentUser,
    dbUser,
    loading,
    profileError,
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
