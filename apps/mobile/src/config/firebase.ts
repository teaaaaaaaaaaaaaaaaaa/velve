/**
 * Firebase configuration with an Expo Go-safe fallback.
 *
 * Development builds use React Native Firebase native modules.
 * Expo Go falls back to the Firebase web SDK so auth can still work there.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isDesignPreviewMode } from '@/config/designPreview';
import { logger } from '@/lib/logger';
import { getStorage } from '@/lib/storage';

type AuthProviderInfo = {
  providerId?: string | null;
};

export type AuthUser = {
  uid: string;
  email?: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData?: AuthProviderInfo[];
};

type AuthStateListener = (user: AuthUser | null) => void;
type AuthCredential = unknown;

const isExpoGo = Constants.appOwnership === 'expo';
const shouldUseFirebaseWebSdk = isExpoGo || Platform.OS === 'web' || isDesignPreviewMode;

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';
const firebaseWebConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
};

function getGoogleOAuthConfigError(clientId: string) {
  if (!clientId) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID is not defined. Google Sign-In will not work.';
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID does not match expected format (.apps.googleusercontent.com).';
  }

  if (/example|placeholder|YOUR_/i.test(clientId)) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID appears to be a placeholder. Update .env with real credentials.';
  }

  return null;
}

function getFirebaseWebConfigError(config: typeof firebaseWebConfig) {
  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!missingKeys.length) {
    return null;
  }

  return `Missing Firebase web config values for Expo Go: ${missingKeys.join(', ')}`;
}

const googleOAuthConfigError = getGoogleOAuthConfigError(googleClientId);
const firebaseWebConfigError = getFirebaseWebConfigError(firebaseWebConfig);

let firebaseApp: any;
let auth: any;
let onAuthStateChangedInternal: any;
let signInWithEmailAndPasswordInternal: any;
let createUserWithEmailAndPasswordInternal: any;
let signInWithCredentialInternal: any;
let signOutInternal: any;
let getAuthTokenInternal: (user: AuthUser, forceRefresh?: boolean) => Promise<string>;
let createGoogleCredentialInternal: (idToken: string) => AuthCredential;
const inFlightTokenRequests = new Map<string, Promise<string>>();

if (shouldUseFirebaseWebSdk) {
  const firebaseAppModule = require('firebase/app') as typeof import('firebase/app');
  const firebaseAuthModule = require('firebase/auth') as typeof import('firebase/auth');

  firebaseApp =
    firebaseAppModule.getApps().length > 0
      ? firebaseAppModule.getApp()
      : firebaseAppModule.initializeApp(firebaseWebConfig);

  try {
    const reactNativePersistence =
      (Platform.OS === 'web' ? firebaseAuthModule.browserLocalPersistence : undefined) ??
      (firebaseAuthModule as any).getReactNativePersistence?.(getStorage()) ??
      firebaseAuthModule.inMemoryPersistence;

    auth = firebaseAuthModule.initializeAuth(firebaseApp as any, {
      persistence: reactNativePersistence,
    }) as typeof auth;
  } catch {
    auth = firebaseAuthModule.getAuth(firebaseApp as any) as typeof auth;
  }

  onAuthStateChangedInternal = firebaseAuthModule.onAuthStateChanged;
  signInWithEmailAndPasswordInternal = firebaseAuthModule.signInWithEmailAndPassword;
  createUserWithEmailAndPasswordInternal = firebaseAuthModule.createUserWithEmailAndPassword;
  signInWithCredentialInternal = firebaseAuthModule.signInWithCredential;
  signOutInternal = firebaseAuthModule.signOut;
  getAuthTokenInternal = (user, forceRefresh = false) =>
    firebaseAuthModule.getIdToken(user as import('firebase/auth').User, forceRefresh);
  createGoogleCredentialInternal = (idToken) =>
    firebaseAuthModule.GoogleAuthProvider.credential(idToken);

  logger.debug('[Firebase] Initialized Firebase web auth fallback with persistent storage');
  if (firebaseWebConfigError) {
    logger.warn(`[Firebase] WARNING: ${firebaseWebConfigError}`);
  }
} else {
  const firebaseAppModule =
    require('@react-native-firebase/app') as typeof import('@react-native-firebase/app');
  const firebaseAuthModule =
    require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');

  firebaseApp = firebaseAppModule.getApp();
  auth = firebaseAuthModule.getAuth(firebaseApp as any) as typeof auth;
  onAuthStateChangedInternal = firebaseAuthModule.onAuthStateChanged;
  signInWithEmailAndPasswordInternal = firebaseAuthModule.signInWithEmailAndPassword;
  createUserWithEmailAndPasswordInternal = firebaseAuthModule.createUserWithEmailAndPassword;
  signInWithCredentialInternal = firebaseAuthModule.signInWithCredential;
  signOutInternal = firebaseAuthModule.signOut;
  getAuthTokenInternal = (user, forceRefresh = false) =>
    firebaseAuthModule.getIdToken(
      user as import('@react-native-firebase/auth').FirebaseAuthTypes.User,
      forceRefresh
    );
  createGoogleCredentialInternal = (idToken) =>
    firebaseAuthModule.GoogleAuthProvider.credential(idToken);

  logger.debug('[Firebase] React Native Firebase initialized');
}

logger.debug('[Firebase] Initial currentUser:', auth.currentUser ? auth.currentUser.uid : 'none');

if (googleOAuthConfigError) {
  logger.warn(`[Firebase] WARNING: ${googleOAuthConfigError}`);
} else {
  logger.debug('[Firebase] Google OAuth config validated successfully');
}

logger.debug('[Firebase] Auth module ready');

async function getAuthToken(user: AuthUser, forceRefresh = false) {
  const requestKey = `${user.uid}:${forceRefresh ? 'refresh' : 'cached'}`;
  const existingRequest = inFlightTokenRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  logger.debug('[Firebase] getAuthToken:start', {
    uid: user.uid,
    forceRefresh,
  });

  const request = getAuthTokenInternal(user, forceRefresh)
    .then((token) => {
      logger.debug('[Firebase] getAuthToken:success', {
        uid: user.uid,
        tokenLength: token.length,
      });
      return token;
    })
    .finally(() => {
      inFlightTokenRequests.delete(requestKey);
    });

  inFlightTokenRequests.set(requestKey, request);
  return request;
}

function onAuthStateChanged(authInstance: unknown, listener: AuthStateListener) {
  return onAuthStateChangedInternal(authInstance ?? auth, listener);
}

function signInWithEmailAndPassword(authInstance: unknown, email: string, password: string) {
  return signInWithEmailAndPasswordInternal(authInstance ?? auth, email, password);
}

function createUserWithEmailAndPassword(authInstance: unknown, email: string, password: string) {
  return createUserWithEmailAndPasswordInternal(authInstance ?? auth, email, password);
}

function signInWithCredential(authInstance: unknown, credential: AuthCredential) {
  return signInWithCredentialInternal(authInstance ?? auth, credential);
}

function signOutUser() {
  return signOutInternal(auth);
}

function createGoogleCredential(idToken: string) {
  return createGoogleCredentialInternal(idToken);
}

export {
  auth,
  createGoogleCredential,
  createUserWithEmailAndPassword,
  firebaseApp,
  firebaseWebConfigError,
  getAuthToken,
  googleClientId,
  googleOAuthConfigError,
  isExpoGo,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOutUser,
};
