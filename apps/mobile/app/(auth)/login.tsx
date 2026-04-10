import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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

  const passwordRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)

  const scrollToForm = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    }, 180)
  }, [])

  useEffect(() => {
    if (!showEmailLogin) return

    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    }, 120)

    return () => clearTimeout(timeoutId)
  }, [showEmailLogin])

  async function handleEmailLogin() {
    setError('')

    if (!email || !password) {
      setError('Unesi email i lozinku.')
      return
    }

    setLoading(true)
    try {
      await signInWithEmail(email, password)
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        setError('Pogresan email ili lozinka.')
      } else if (e.code === 'auth/wrong-password') {
        setError('Pogresna lozinka.')
      } else if (e.code === 'auth/too-many-requests') {
        setError('Previse pokusaja. Pokusaj ponovo kasnije.')
      } else {
        setError('Greska pri prijavi. Pokusaj ponovo.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    try {
      await signInWithGoogle()
    } catch (e: any) {
      if (e.message === 'USER_CANCELLED') {
        return
      }

      let title = 'Google prijava'
      let message = 'Doslo je do greske. Pokusaj ponovo.'

      if (e.message === 'GOOGLE_SIGNIN_UNAVAILABLE') {
        message =
          googleSignInUnavailableReason ||
          'Google prijava zahteva development build ili novu native instalaciju aplikacije.'
      } else if (e.message?.includes('CLIENT_ID')) {
        message = 'Aplikacija nije pravilno konfigurisana. Kontaktiraj podrsku.'
      } else if (e.message === 'NETWORK_ERROR') {
        message = 'Proveri internet konekciju i pokusaj ponovo.'
      } else if (e.message === 'OAUTH_FAILED') {
        message = 'Google prijava nije uspela. Pokusaj ponovo.'
      }

      Alert.alert(title, message)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={{ flex: 1 }}
    >
      <BrandBackground />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 28, 64),
          paddingBottom: Math.max(insets.bottom + 32, 40),
        }}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
          <BrandWordmark width={220} />
        </View>

        <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          {showEmailLogin ? (
            <View>
              <TextInput
                className="mb-4 rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.mutedText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                onFocus={scrollToForm}
              />

              <TextInput
                ref={passwordRef}
                className="rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
                onFocus={scrollToForm}
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
                onPress={() => {
                  setShowEmailLogin(false)
                  setError('')
                }}
              >
                <Text className="font-sans text-base font-medium text-ink-dark">
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                className={
                  googleSignInAvailable
                    ? 'items-center rounded-pill bg-brand-accent-deep px-4 py-4'
                    : 'items-center rounded-pill bg-ink-dark/10 px-4 py-4'
                }
                onPress={handleGoogleLogin}
                disabled={!googleSignInAvailable}
              >
                <Text
                  className={
                    googleSignInAvailable
                      ? 'font-sans text-base font-semibold text-base-canvas'
                      : 'font-sans text-base font-semibold text-ink-dark/45'
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
                onPress={() => setShowEmailLogin(true)}
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

          <View className="mt-5 flex-row items-center justify-between">
            <Text className="font-sans text-sm text-ink-dark/50">{t('auth.tagline')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                {showEmailLogin ? t('auth.noAccount') : t('auth.register')}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
