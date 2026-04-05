/**
 * React Native Firebase configuration
 *
 * NOTE: React Native Firebase reads configuration from native files:
 * - Android: android/app/google-services.json
 * - iOS: ios/GoogleService-Info.plist
 *
 * These files are generated during `npx expo prebuild` from app.json
 */

import auth from '@react-native-firebase/auth';

console.log('[Firebase] React Native Firebase initialized');

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

console.log('[Firebase] Auth module ready');

export { auth };
