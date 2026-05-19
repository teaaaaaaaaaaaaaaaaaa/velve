import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { BrandedLoader } from '@/components/BrandedLoader';
import { VelveFeedbackProvider } from '@/components/VelveFeedbackProvider';
import { isDesignPreviewMode } from '@/config/designPreview';
import { previewUser } from '@/design/previewData';
import {
  useAuth,
  useAuthProvider,
  AuthContext,
  type AuthContextType,
  type DbUser,
} from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { I18nProvider, useI18n } from '@/i18n';
import { getProfileResolutionCopy } from '@/lib/authFeedback';

export { ErrorBoundary };

const previewAuth: AuthContextType = {
  currentUser: {
    uid: previewUser.firebaseUid,
    email: previewUser.email,
    emailVerified: true,
    isAnonymous: false,
    providerData: [{ providerId: 'design-preview' }],
  },
  dbUser: previewUser as DbUser,
  loading: false,
  profileError: null,
  googleSignInAvailable: false,
  googleSignInUnavailableReason: 'Design preview uses a mock authenticated session.',
  refreshDbUser: async () => undefined,
  signInWithGoogle: async () => undefined,
  signInWithEmail: async () => ({ user: previewAuth.currentUser }),
  registerWithEmail: async () => ({ user: previewAuth.currentUser }),
  logout: async () => undefined,
};

function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="design-preview" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="items/[id]" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="blocked-users" />
      <Stack.Screen name="rate-trade" />
      <Stack.Screen name="upload-flow" />
      <Stack.Screen name="vto" />
      <Stack.Screen name="trade-archive" />
    </Stack>
  );
}

function AuthGate() {
  const { currentUser, loading, profileError, refreshDbUser, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({
    Ballet: require('../assets/fonts/Ballet-Regular.ttf'),
    'AlteHaasGrotesk-Bold': require('../assets/fonts/AlteHaasGrotesk-Bold.ttf'),
    Inter: require('../assets/fonts/Inter-Variable.ttf'),
  });

  const [minSplashDone, setMinSplashDone] = useState(false);
  const profileResolution = getProfileResolutionCopy(profileError, t);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Register push notifications when user is logged in
  usePushNotifications();

  useEffect(() => {
    if (loading || !minSplashDone) return;

    console.log('[AuthGate] Evaluating navigation state', {
      currentUserUid: currentUser?.uid ?? null,
      loading,
      minSplashDone,
      segments,
    });
    const rootSegment = String(segments[0] ?? '');
    const inAuthGroup = rootSegment === '(auth)';
    const inDesignPreview = rootSegment === 'design-preview';
    const inOnboarding = rootSegment === 'onboarding';
    const inTabs = rootSegment === '(tabs)';
    const inItems = rootSegment === 'items';
    const inUsers = rootSegment === 'users';
    const inSearch = rootSegment === 'search';
    const inSettings = rootSegment === 'settings';
    const inNotifications = rootSegment === 'notifications';
    const inConnections = rootSegment === 'connections';
    const inBlockedUsers = rootSegment === 'blocked-users';
    const inRateTrade = rootSegment === 'rate-trade';
    const inUploadFlow = rootSegment === 'upload-flow';
    const inVto = rootSegment === 'vto';
    const inTradeArchive = rootSegment === 'trade-archive';
    const isIndex = rootSegment === '';
    const isGuestPreviewRoute = inTabs && String(segments[1] ?? '') === 'feed';

    if (!currentUser && isIndex) {
      router.replace('/(tabs)/feed');
    } else if (!currentUser && !inAuthGroup && !inDesignPreview && !isGuestPreviewRoute) {
      console.log('[AuthGate] Redirecting signed-out user to /(auth)/login');
      router.replace('/(auth)/login');
    } else if (currentUser && inAuthGroup) {
      console.log('[AuthGate] Redirecting signed-in user from auth group to /');
      router.replace('/');
    } else if (
      currentUser &&
      !inOnboarding &&
      !inTabs &&
      !inItems &&
      !inUsers &&
      !inSearch &&
      !inSettings &&
      !inNotifications &&
      !inConnections &&
      !inBlockedUsers &&
      !inRateTrade &&
      !inUploadFlow &&
      !inVto &&
      !inTradeArchive &&
      !inDesignPreview &&
      !isIndex
    ) {
      console.log(
        '[AuthGate] Redirecting signed-in user to home because route is outside allowed groups'
      );
      router.replace('/');
    }
  }, [currentUser, loading, segments, minSplashDone]);

  if (loading || !fontsLoaded || !minSplashDone) {
    return <BrandedLoader label={t('common.loading')} />;
  }

  if (currentUser && profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas px-5">
        <View className="w-full rounded-[28px] bg-surface-panel px-5 py-6">
          <Text className="font-display text-3xl text-ink-dark">{profileResolution.title}</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/62">
            {profileResolution.message}
          </Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/62">
            {profileResolution.recovery}
          </Text>
          <Text className="mt-3 font-sans text-xs text-ink-dark/45">{profileError}</Text>

          <TouchableOpacity
            onPress={refreshDbUser}
            className="mt-6 items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {t('common.retry')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={logout}
            className="mt-3 items-center rounded-full border border-ink-dark/10 bg-base-canvas/70 px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-ink-dark">
              {t('profile.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <AppStack />;
}

function AppRootLayout() {
  const auth = useAuthProvider();

  return (
    <I18nProvider>
      <AuthContext.Provider value={auth}>
        <VelveFeedbackProvider>
          <AuthGate />
        </VelveFeedbackProvider>
      </AuthContext.Provider>
    </I18nProvider>
  );
}

function PreviewGate() {
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({
    Ballet: require('../assets/fonts/Ballet-Regular.ttf'),
    'AlteHaasGrotesk-Bold': require('../assets/fonts/AlteHaasGrotesk-Bold.ttf'),
    Inter: require('../assets/fonts/Inter-Variable.ttf'),
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    if (!segments[0]) {
      router.replace('/design-preview' as never);
    }
  }, [fontsLoaded, router, segments]);

  if (!fontsLoaded) {
    return <BrandedLoader label="Loading Velve design preview" />;
  }

  return <AppStack />;
}

function PreviewRootLayout() {
  return (
    <I18nProvider>
      <AuthContext.Provider value={previewAuth}>
        <VelveFeedbackProvider>
          <PreviewGate />
        </VelveFeedbackProvider>
      </AuthContext.Provider>
    </I18nProvider>
  );
}

function RootLayout() {
  return isDesignPreviewMode ? <PreviewRootLayout /> : <AppRootLayout />;
}

export default RootLayout;
