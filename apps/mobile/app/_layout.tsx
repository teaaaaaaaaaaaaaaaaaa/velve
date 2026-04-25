import '../global.css'
import React, { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router'
import { useFonts } from 'expo-font'
import { BrandedLoader } from '@/components/BrandedLoader'
import { useAuth, useAuthProvider, AuthContext } from '@/hooks/useAuth'
import { I18nProvider, useI18n } from '@/i18n'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export { ErrorBoundary }

function AuthGate() {
  const { currentUser, loading } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const segments = useSegments()
  const [fontsLoaded] = useFonts({
    Ballet: require('../assets/fonts/Ballet-Regular.ttf'),
    'AlteHaasGrotesk-Bold': require('../assets/fonts/AlteHaasGrotesk-Bold.ttf'),
    Inter: require('../assets/fonts/Inter-Variable.ttf'),
  })

  const [minSplashDone, setMinSplashDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  // Register push notifications when user is logged in
  usePushNotifications()

  useEffect(() => {
    if (loading || !minSplashDone) return

    console.log('[AuthGate] Evaluating navigation state', {
      currentUserUid: currentUser?.uid ?? null,
      loading,
      minSplashDone,
      segments,
    })
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'
    const inItems = segments[0] === 'items'
    const inUsers = segments[0] === 'users'
    const inSearch = segments[0] === 'search'
    const inSettings = segments[0] === 'settings'
    const inUploadFlow = segments[0] === 'upload-flow'
    const inVto = segments[0] === 'vto'
    const inTradeArchive = segments[0] === 'trade-archive'
    const isIndex = false // TypeScript knows segments.length is never 0

    if (!currentUser && !inAuthGroup) {
      console.log('[AuthGate] Redirecting signed-out user to /(auth)/login')
      router.replace('/(auth)/login')
    } else if (currentUser && inAuthGroup) {
      console.log('[AuthGate] Redirecting signed-in user from auth group to /')
      router.replace('/')
    } else if (currentUser && !inOnboarding && !inTabs && !inItems && !inUsers && !inSearch && !inSettings && !inUploadFlow && !inVto && !inTradeArchive && !isIndex) {
      console.log('[AuthGate] Redirecting signed-in user to home because route is outside allowed groups')
      router.replace('/')
    }
  }, [currentUser, loading, segments, minSplashDone])

  if (loading || !fontsLoaded || !minSplashDone) {
    return <BrandedLoader label={t('common.loading')} />
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
        <Stack.Screen name="upload-flow" />
        <Stack.Screen name="vto" />
        <Stack.Screen name="trade-archive" />
      </Stack>
  )
}

function RootLayout() {
  const auth = useAuthProvider()

  return (
    <I18nProvider>
      <AuthContext.Provider value={auth}>
        <AuthGate />
      </AuthContext.Provider>
    </I18nProvider>
  )
}

export default RootLayout
