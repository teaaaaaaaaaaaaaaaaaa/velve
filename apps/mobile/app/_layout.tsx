import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { BrandedLoader } from '@/components/BrandedLoader';
import { VelveFeedbackProvider } from '@/components/VelveFeedbackProvider';
import { useAuth, useAuthProvider, AuthContext } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { I18nProvider, useI18n } from '@/i18n';
import { getProfileResolutionCopy } from '@/lib/authFeedback';

export { ErrorBoundary };

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
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    const inItems = segments[0] === 'items';
    const inUsers = segments[0] === 'users';
    const inSearch = segments[0] === 'search';
    const inSettings = segments[0] === 'settings';
    const inNotifications = segments[0] === 'notifications';
    const inConnections = segments[0] === 'connections';
    const inBlockedUsers = segments[0] === 'blocked-users';
    const inRateTrade = segments[0] === 'rate-trade';
    const inUploadFlow = segments[0] === 'upload-flow';
    const inVto = segments[0] === 'vto';
    const inTradeArchive = segments[0] === 'trade-archive';
    const isIndex = false; // TypeScript knows segments.length is never 0

    if (!currentUser && !inAuthGroup) {
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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
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

function RootLayout() {
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

export default RootLayout;
