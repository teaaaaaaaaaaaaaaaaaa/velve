import '../global.css'
import React, { useEffect } from 'react'
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

  // Register push notifications when user is logged in
  usePushNotifications()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'
    const inItems = segments[0] === 'items'
    const inUsers = segments[0] === 'users'
    const inSearch = segments[0] === 'search'
    const isIndex = false // TypeScript knows segments.length is never 0

    if (!currentUser && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (currentUser && inAuthGroup) {
      router.replace('/')
    } else if (currentUser && !inOnboarding && !inTabs && !inItems && !inUsers && !inSearch && !isIndex) {
      router.replace('/')
    }
  }, [currentUser, loading, segments])

  if (loading || !fontsLoaded) {
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
