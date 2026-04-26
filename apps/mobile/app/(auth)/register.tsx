import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.trim().split('@')
  if (!domain) return `${localPart.slice(0, 2)}***`
  return `${localPart.slice(0, 2)}***@${domain}`
}

function getEmailRegisterError(error: any) {
  const code = error?.code || error?.nativeErrorCode || ''

  if (code === 'auth/email-already-in-use') {
    return 'Ovaj email vec ima nalog. Vrati se na prijavu.'
  }
  if (code === 'auth/invalid-email') return 'Unesi ispravan email.'
  if (code === 'auth/weak-password') return 'Lozinka je preslaba. Koristi najmanje 8 karaktera.'
  if (code === 'auth/operation-not-allowed') {
    return 'Email registracija trenutno nije ukljucena za ovu aplikaciju.'
  }
  if (code === 'auth/network-request-failed' || error?.message?.includes('Network')) {
    return 'Nema stabilne internet konekcije. Proveri mrezu i pokusaj ponovo.'
  }

  return 'Nije moguce napraviti nalog trenutno. Pokusaj ponovo.'
}

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { registerWithEmail } = useAuth()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)

  async function handleRegister() {
    setError('')
    const normalizedEmail = email.trim()

    if (!validateEmail(normalizedEmail)) {
      console.warn('[RegisterScreen] Registration blocked because email is invalid', {
        email: maskEmail(normalizedEmail),
      })
      setError('Unesi ispravan email.')
      return
    }

    if (password.length < 8) {
      console.warn('[RegisterScreen] Registration blocked because password is too short', {
        email: maskEmail(email),
        passwordLength: password.length,
      })
      setError('Lozinka mora imati najmanje 8 karaktera.')
      return
    }

    console.log('[RegisterScreen] Register pressed', {
      email: maskEmail(normalizedEmail),
      passwordLength: password.length,
    })
    setLoading(true)
    try {
      await registerWithEmail(normalizedEmail, password)
      console.log('[RegisterScreen] Registration request resolved successfully')
    } catch (e: any) {
      console.error('[RegisterScreen] Registration failed', {
        code: e?.code,
        message: e?.message,
        nativeErrorCode: e?.nativeErrorCode,
      })
      setError(getEmailRegisterError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      style={{ flex: 1 }}
    >
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
        <View className="items-center" style={{ marginBottom: 28 }}>
          <BrandWordmark width={176} />
          <Text className="mt-4 text-center font-sans text-sm text-ink-dark/60">
            {t('auth.registerDescription')}
          </Text>
        </View>

        <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
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
          />

          <TextInput
            ref={passwordRef}
            className="rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
            placeholder={t('auth.passwordLongPlaceholder')}
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          {error ? (
            <Text className="mt-4 font-sans text-sm leading-6" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            className="mt-5 items-center rounded-pill bg-brand-accent-deep px-4 py-4"
            onPress={handleRegister}
            disabled={loading}
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {loading ? `${t('auth.register')}...` : t('auth.register')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 items-center rounded-pill border border-ink-dark/10 bg-base-canvas/70 px-4 py-4"
            onPress={() => router.back()}
          >
            <Text className="font-sans text-base font-medium text-ink-dark">
              {t('auth.haveAccount')}
            </Text>
          </TouchableOpacity>
        </GlassSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
