import { useRef, useState } from 'react'
import { Alert } from '@/lib/velveAlert'
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { GlassSurface } from '@/components/GlassSurface'
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen'
import { VelveTextInput, type VelveTextInputRef } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.trim().split('@')
  if (!domain) return `${localPart.slice(0, 2)}***`
  return `${localPart.slice(0, 2)}***@${domain}`
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function getEmailLoginError(error: any) {
  const code = error?.code || error?.nativeErrorCode || ''

  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Wrong email or password.'
  }

  if (code === 'auth/invalid-email') return 'Enter a valid email.'
  if (code === 'auth/user-disabled') return 'This account has been disabled.'
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a bit and try again.'
  }
  if (code === 'auth/network-request-failed' || error?.message?.includes('Network')) {
    return 'No stable internet connection. Check your network and try again.'
  }

  return 'Unable to sign in right now. Try again.'
}

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const {
    signInWithGoogle,
    signInWithEmail,
    googleSignInAvailable,
    googleSignInUnavailableReason,
  } = useAuth()
  const { t } = useI18n()

  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordRef = useRef<VelveTextInputRef>(null)
  const scrollRef = useRef<ScrollView>(null)

  async function handleEmailLogin() {
    setError('')
    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      console.warn('[LoginScreen] Email login blocked because fields are empty')
      setError('Enter your email and password.')
      return
    }

    if (!validateEmail(normalizedEmail)) {
      setError('Enter a valid email.')
      return
    }

    console.log('[LoginScreen] Email login pressed', {
      email: maskEmail(normalizedEmail),
      passwordLength: password.length,
    })
    setLoading(true)
    try {
      await signInWithEmail(normalizedEmail, password)
      console.log('[LoginScreen] Email login request resolved successfully')
    } catch (e: any) {
      console.error('[LoginScreen] Email login failed', {
        code: e?.code,
        message: e?.message,
        nativeErrorCode: e?.nativeErrorCode,
      })
      setError(getEmailLoginError(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    try {
      console.log('[LoginScreen] Google login pressed')
      await signInWithGoogle()
      console.log('[LoginScreen] Google login request resolved successfully')
    } catch (e: any) {
      console.error('[LoginScreen] Google login failed', {
        code: e?.code,
        message: e?.message,
      })
      if (e.message === 'USER_CANCELLED') {
        return
      }

      let title = 'Google sign-in'
      let message = 'Something went wrong. Try again.'

      if (e.message === 'GOOGLE_SIGNIN_UNAVAILABLE') {
        message =
          googleSignInUnavailableReason ||
          'Google sign-in requires a development build or a fresh native app install.'
      } else if (e.message?.includes('CLIENT_ID')) {
        message = 'The app is not configured correctly. Contact support.'
      } else if (e.message === 'NETWORK_ERROR') {
        message = 'Check your internet connection and try again.'
      } else if (e.message === 'OAUTH_FAILED') {
        message = 'Google sign-in failed. Try again.'
      }

      Alert.alert(title, message)
    }
  }

  return (
    <KeyboardAwareScreen className="bg-base-canvas" offset={10}>
      <BrandBackground />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 24, 48),
          paddingBottom: Math.max(insets.bottom + 28, 36),
          minHeight: height,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" style={{ marginBottom: showEmailLogin ? 28 : 40 }}>
          <BrandWordmark width={showEmailLogin ? 176 : 220} />
          <Text className="mt-4 text-center font-sans text-sm text-ink-dark/60">
            {t('auth.tagline')}
          </Text>
        </View>

        <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          {showEmailLogin ? (
            <View>
              <VelveTextInput
                className="mb-4 rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              <VelveTextInput
                ref={passwordRef}
                className="rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
              />

              {error ? (
                <Text className="mt-4 font-sans text-sm leading-6" style={{ color: colors.danger }}>
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                className="mt-5 items-center rounded-pill bg-brand-accent-deep px-4 py-4"
                onPress={handleEmailLogin}
                disabled={loading}
              >
                <Text className="font-sans text-base font-semibold text-base-canvas">
                  {loading ? `${t('auth.signIn')}...` : t('auth.signIn')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-3 items-center rounded-pill border border-ink-dark/10 bg-base-canvas/70 px-4 py-4"
                onPress={() => router.push('/(auth)/register')}
              >
                <Text className="font-sans text-base font-medium text-ink-dark">
                  {t('auth.register')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                className={
                  googleSignInAvailable
                    ? 'items-center rounded-pill bg-brand-accent-deep px-4 py-4'
                    : 'items-center rounded-pill bg-brand-accent-deep px-4 py-4 opacity-40'
                }
                onPress={handleGoogleLogin}
                disabled={!googleSignInAvailable}
              >
                <Text
                  className={
                    googleSignInAvailable
                      ? 'font-sans text-base font-semibold text-base-canvas'
                      : 'font-sans text-base font-semibold text-base-canvas'
                  }
                >
                  {t('auth.google')}
                </Text>
              </TouchableOpacity>

              {!googleSignInAvailable && googleSignInUnavailableReason ? (
                <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/60">
                  {googleSignInUnavailableReason}
                </Text>
              ) : null}

              <TouchableOpacity
                className={
                  googleSignInAvailable
                    ? 'mt-3 items-center rounded-pill border border-base-canvas/70 bg-base-canvas/70 px-4 py-4'
                    : 'mt-3 items-center rounded-pill bg-brand-accent-deep px-4 py-4'
                }
                onPress={() => {
                  console.log('[LoginScreen] Switching to email login form')
                  setShowEmailLogin(true)
                }}
              >
                <Text
                  className={
                    googleSignInAvailable
                      ? 'font-sans text-base font-medium text-ink-dark'
                      : 'font-sans text-base font-semibold text-base-canvas'
                  }
                >
                  {t('auth.email')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showEmailLogin ? (
            <TouchableOpacity
              className="mt-5 items-center"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                {t('auth.register')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </GlassSurface>
      </ScrollView>
    </KeyboardAwareScreen>
  )
}
