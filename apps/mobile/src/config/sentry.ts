import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export function initSentry() {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.warn('[Sentry] Sentry DSN not configured - error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !__DEV__, // Disable in development, enable in production
    debug: __DEV__,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version,
  });

  console.log('[Sentry] Error monitoring initialized');
}
