import { createContext, useContext, useState, useEffect } from 'react'
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import client from '@/api/client'

WebBrowser.maybeCompleteAuthSession()

type AuthContextType = {
  currentUser: FirebaseAuthTypes.User | null
  dbUser: DbUser | null
  loading: boolean
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
  onboardingCompleted: boolean
  stylePreferences: string[]
  favoriteBrands: string[]
  categories: string[]
  sizes: { clothing: string; shoes: string }
  location: { city: string; region: string }
  followersCount: number
  followingCount: number
  itemsCount: number
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthProvider() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null)
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      setCurrentUser(user)

      if (user) {
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
              setLoading(false)
              return
            }

            setDbUser(fetchedDbUser)
            console.log('[Auth] dbUser loaded:', fetchedDbUser._id)
          }
        } catch (error) {
          console.error('[Auth] Failed to fetch dbUser:', error)
          setDbUser(null)
        }
      } else {
        setDbUser(null)
      }

      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signInWithGoogle() {
    try {
      // Validate CLIENT_ID before attempting OAuth
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
        throw new Error('CLIENT_ID_INVALID: Google OAuth is not properly configured');
      }

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'velve',
        path: 'auth/callback'
      })

      console.log('[Google Auth] Redirect URI:', redirectUri)

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      }

      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
      })

      const result = await request.promptAsync(discovery)

      if (result.type === 'cancel') {
        // User cancelled - throw specific error
        throw new Error('USER_CANCELLED')
      }

      if (result.type !== 'success') {
        // OAuth flow failed
        throw new Error('OAUTH_FAILED')
      }

      // Success - exchange token
      const { id_token } = result.params

      if (!id_token) {
        throw new Error('OAUTH_FAILED: No ID token received')
      }

      const credential = auth.GoogleAuthProvider.credential(id_token)
      await auth().signInWithCredential(credential)

      // onAuthStateChanged will automatically fetch dbUser
    } catch (error: any) {
      console.error('[Google Auth] Error:', error)

      // Re-throw USER_CANCELLED silently (caller can handle)
      if (error.message === 'USER_CANCELLED') {
        throw error
      }

      // Check for network errors
      if (error.message?.toLowerCase().includes('network') || error.code === 'auth/network-request-failed') {
        throw new Error('NETWORK_ERROR')
      }

      // Re-throw all other errors
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

  return { currentUser, dbUser, loading, signInWithGoogle, signInWithEmail, registerWithEmail, logout }
}

export { AuthContext }

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
