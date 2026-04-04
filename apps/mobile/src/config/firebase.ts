import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// @ts-expect-error - getReactNativePersistence exists in React Native build but not in TS definitions
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('[Firebase] Initializing Firebase config...');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate Google OAuth configuration
function validateGoogleOAuthConfig() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.warn('[Firebase] WARNING: EXPO_PUBLIC_GOOGLE_CLIENT_ID is not defined. Google Sign-In will not work.');
    return false;
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    console.warn('[Firebase] WARNING: EXPO_PUBLIC_GOOGLE_CLIENT_ID does not match expected format (.apps.googleusercontent.com)');
    return false;
  }

  // Check for placeholder/example values
  if (clientId.includes('example') || clientId.includes('placeholder') || clientId.includes('YOUR_')) {
    console.warn('[Firebase] WARNING: EXPO_PUBLIC_GOOGLE_CLIENT_ID appears to be a placeholder. Update .env with real credentials.');
    return false;
  }

  console.log('[Firebase] Google OAuth config validated successfully');
  return true;
}

// Run validation
validateGoogleOAuthConfig();

// Zaštita od duplog initializovanja (hot reload)
let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  console.log('[Firebase] First init - creating app and auth');
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  console.log('[Firebase] Already initialized - reusing existing app');
  app = getApp();
  auth = getAuth(app);
}

console.log('[Firebase] Firebase ready, projectId:', firebaseConfig.projectId);

export { auth };
