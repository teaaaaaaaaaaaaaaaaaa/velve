import { createContext, useContext, useEffect, useState } from 'react';

import client from '@/api/client';
import {
  auth,
  createGoogleCredential,
  createUserWithEmailAndPassword,
  googleClientId,
  googleOAuthConfigError,
  isExpoGo,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOutUser,
  type AuthUser,
} from '@/config/firebase';
import { isExpectedAuthError, type FirebaseErrorLike } from '@/lib/authFeedback';
import { logger } from '@/lib/logger';

export type AuthContextType = {
  currentUser: AuthUser | null;
  dbUser: DbUser | null;
  loading: boolean;
  profileError: string | null;
  googleSignInAvailable: boolean;
  googleSignInUnavailableReason: string | null;
  refreshDbUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<unknown>;
  registerWithEmail: (email: string, password: string) => Promise<unknown>;
  logout: () => Promise<void>;
};

export type DbUser = {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL: string;
  bio?: string;
  emailVerified?: boolean;
  averageRating?: number;
  completedTrades?: number;
  bodyScanUrl?: string | null;
  bodyScanCreatedAt?: string | null;
  onboardingCompleted: boolean;
  stylePreferences: string[];
  favoriteBrands: string[];
  categories: string[];
  sizes: { clothing: string; shoes: string };
  location: { city: string; region: string };
  followersCount: number;
  followingCount: number;
  itemsCount: number;
  joinedAt?: string;
  responseRate?: number | null;
  successfulSwaps?: number;
  profileCompleteness?: number;
  closetCounts?: { live: number; drafts: number; archive: number };
};

type GoogleSignInModule = {
  GoogleSignin: {
    configure: (options: { webClientId: string; scopes: string[] }) => void;
    hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
    signIn: () => Promise<
      { type: 'success'; data: { idToken: string | null } } | { type: 'cancelled' }
    >;
  };
  statusCodes?: {
    SIGN_IN_CANCELLED?: string;
  };
};

const AuthContext = createContext<AuthContextType | null>(null);

const GOOGLE_SIGNIN_UNAVAILABLE = 'GOOGLE_SIGNIN_UNAVAILABLE';
const NETWORK_ERROR = 'NETWORK_ERROR';
const OAUTH_FAILED = 'OAUTH_FAILED';
const USER_CANCELLED = 'USER_CANCELLED';

let cachedGoogleSignInModule: GoogleSignInModule | null | undefined;
let hasConfiguredGoogleSignin = false;

function logAuthFailure(scope: string, error: FirebaseErrorLike) {
  const logFn = isExpectedAuthError(error) ? logger.warn : logger.error;
  logFn(scope, {
    code: error?.code,
    message: error?.message,
    nativeErrorCode: error?.nativeErrorCode,
    user: summarizeUser(auth.currentUser),
  });
}

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [localPart = '', domain = ''] = String(email).split('@');
  if (!domain) return `${localPart.slice(0, 2)}***`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function summarizeUser(user: AuthUser | null) {
  if (!user) {
    return { state: 'signed-out' };
  }

  return {
    uid: user.uid,
    email: maskEmail(user.email),
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    providers: user.providerData?.map((provider) => provider?.providerId).filter(Boolean) ?? [],
  };
}

function getGoogleSignInSupport() {
  if (googleOAuthConfigError) {
    logger.warn('[Google Auth] Support unavailable because OAuth config is invalid');
    return {
      available: false,
      module: null,
      unavailableReason: 'Google prijava nije konfigurirana. Proveri EXPO_PUBLIC_GOOGLE_CLIENT_ID.',
    };
  }

  if (isExpoGo) {
    logger.debug('[Google Auth] Native Google Sign-In disabled in Expo Go');
    return {
      available: false,
      module: null,
      unavailableReason:
        'Google prijava nije dostupna u Expo Go. Koristi email prijavu ili pokreni development build.',
    };
  }

  if (cachedGoogleSignInModule === undefined) {
    try {
      cachedGoogleSignInModule =
        require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    } catch {
      logger.warn(
        '[Google Auth] Native Google Sign-In module is unavailable in this binary. Rebuild the Android app or open a dev build.'
      );
      cachedGoogleSignInModule = null;
    }
  }

  if (!cachedGoogleSignInModule) {
    return {
      available: false,
      module: null,
      unavailableReason:
        'Ova instalacija nema Google Sign-In native modul. Koristi email prijavu ili instaliraj novu build varijantu.',
    };
  }

  if (!hasConfiguredGoogleSignin) {
    logger.debug('[Google Auth] Configuring native Google Sign-In module');
    cachedGoogleSignInModule.GoogleSignin.configure({
      webClientId: googleClientId,
      scopes: ['profile', 'email'],
    });
    hasConfiguredGoogleSignin = true;
  }

  return {
    available: true,
    module: cachedGoogleSignInModule,
    unavailableReason: null,
  };
}

export function useAuthProvider() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const googleSignInSupport = getGoogleSignInSupport();

  async function loadDbUser(user: AuthUser) {
    logger.debug('[Auth] loadDbUser:start', summarizeUser(user));
    setProfileError(null);

    try {
      const response = await client.get('/api/users/me');
      logger.debug('[Auth] loadDbUser:response', {
        status: response.status,
        ok: response.data?.ok,
        dbUserId: response.data?.data?._id,
        dbUserFirebaseUid: response.data?.data?.firebaseUid,
        onboardingCompleted: response.data?.data?.onboardingCompleted,
      });
      if (response.data.ok) {
        const fetchedDbUser = response.data.data;

        // Validate Firebase UID matches MongoDB firebaseUid
        if (fetchedDbUser.firebaseUid !== user.uid) {
          logger.error('[Auth] User mismatch detected!', {
            firebaseUid: user.uid,
            dbUserFirebaseUid: fetchedDbUser.firebaseUid,
          });
          await signOutUser();
          setCurrentUser(null);
          setDbUser(null);
          setProfileError('USER_MISMATCH');
          return;
        }

        setDbUser(fetchedDbUser);
        logger.debug('[Auth] loadDbUser:success', {
          dbUserId: fetchedDbUser._id,
          firebaseUid: fetchedDbUser.firebaseUid,
          onboardingCompleted: fetchedDbUser.onboardingCompleted,
        });
        return;
      }

      logger.error('[Auth] Unexpected /api/users/me response:', response.data);
      setDbUser(null);
      setProfileError('INVALID_PROFILE_RESPONSE');
    } catch (unknownError: unknown) {
      const error = unknownError as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      const message =
        (error?.response?.data as { error?: string } | undefined)?.error ||
        error?.message ||
        'UNKNOWN_PROFILE_ERROR';

      logger.error('[Auth] loadDbUser:error', {
        message,
        status: error?.response?.status,
        response: error?.response?.data,
      });
      setDbUser(null);
      setProfileError(message);
    }
  }

  async function refreshDbUser() {
    const user = auth.currentUser;
    if (!user) {
      logger.debug('[Auth] refreshDbUser skipped - no signed in user');
      return;
    }

    logger.debug('[Auth] refreshDbUser:start', summarizeUser(user));
    setLoading(true);
    await loadDbUser(user);
    setLoading(false);
    logger.debug('[Auth] refreshDbUser:done', {
      currentUser: summarizeUser(auth.currentUser),
    });
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      logger.debug('[Auth] onAuthStateChanged', summarizeUser(user));
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        await loadDbUser(user);
      } else {
        setDbUser(null);
        setProfileError(null);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    if (!googleSignInSupport.available || !googleSignInSupport.module) {
      logger.warn('[Google Auth] signInWithGoogle blocked because support is unavailable');
      throw new Error(GOOGLE_SIGNIN_UNAVAILABLE);
    }

    try {
      logger.debug('[Google Auth] signInWithGoogle:start');
      await googleSignInSupport.module.GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      logger.debug('[Google Auth] Play Services check passed');

      const userInfo = await googleSignInSupport.module.GoogleSignin.signIn();
      logger.debug('[Google Auth] Native signIn result:', {
        type: userInfo.type,
        hasIdToken: userInfo.type === 'success' ? Boolean(userInfo.data?.idToken) : false,
      });

      if (userInfo.type !== 'success') {
        throw new Error(USER_CANCELLED);
      }

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        throw new Error(OAUTH_FAILED);
      }

      const credential = createGoogleCredential(idToken);
      const signedIn = await signInWithCredential(auth, credential);
      logger.debug(
        '[Google Auth] Firebase credential sign-in success',
        summarizeUser(signedIn.user)
      );

      // onAuthStateChanged will automatically fetch dbUser
    } catch (unknownError: unknown) {
      const error = unknownError as FirebaseErrorLike;
      const logFn =
        error?.message === USER_CANCELLED || error?.message === GOOGLE_SIGNIN_UNAVAILABLE
          ? logger.warn
          : logger.error;
      logFn('[Google Auth] Error:', {
        code: error?.code,
        message: error?.message,
      });

      if (
        error?.message === USER_CANCELLED ||
        error?.code === googleSignInSupport.module.statusCodes?.SIGN_IN_CANCELLED
      ) {
        throw new Error(USER_CANCELLED);
      }

      if (error?.message === GOOGLE_SIGNIN_UNAVAILABLE) {
        throw unknownError;
      }

      if (
        error?.message?.toLowerCase().includes('network') ||
        error?.code === 'auth/network-request-failed'
      ) {
        throw new Error(NETWORK_ERROR);
      }

      throw unknownError;
    }
  }

  async function signInWithEmail(email: string, password: string) {
    logger.debug('[Auth] signInWithEmail:start', {
      email: maskEmail(email),
      passwordLength: password.length,
    });
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      logger.debug('[Auth] signInWithEmail:success', summarizeUser(credential.user));
      return credential;
    } catch (unknownError: unknown) {
      logAuthFailure('[Auth] signInWithEmail:error', unknownError as FirebaseErrorLike);
      throw unknownError;
    }
  }

  async function registerWithEmail(email: string, password: string) {
    logger.debug('[Auth] registerWithEmail:start', {
      email: maskEmail(email),
      passwordLength: password.length,
    });
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      logger.debug('[Auth] registerWithEmail:success', summarizeUser(credential.user));
      return credential;
    } catch (unknownError: unknown) {
      logAuthFailure('[Auth] registerWithEmail:error', unknownError as FirebaseErrorLike);
      throw unknownError;
    }
  }

  async function logout() {
    logger.debug('[Auth] logout:start', summarizeUser(auth.currentUser));
    await signOutUser();
    logger.debug('[Auth] logout:done');
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
  };
}

export { AuthContext };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
