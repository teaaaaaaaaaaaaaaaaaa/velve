import { useCallback, useRef, useState } from 'react'
import {
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

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { registerWithEmail } = useAuth()
  const { t } = useI18n()

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

  async function handleRegister() {
    setError('')

    if (!validateEmail(email)) {
      setError('Unesi ispravan email.')
      return
    }

    if (password.length < 8) {
      setError('Lozinka mora imati najmanje 8 karaktera.')
      return
    }

    setLoading(true)
    try {
      await registerWithEmail(email, password)
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        setError('Ovaj email je vec registrovan.')
      } else if (e.code === 'auth/invalid-email') {
        setError('Neispravan email format.')
      } else {
        setError('Greska pri registraciji. Pokusaj ponovo.')
      }
    } finally {
      setLoading(false)
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
            placeholder={t('auth.passwordLongPlaceholder')}
            placeholderTextColor={colors.mutedText}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            onFocus={scrollToForm}
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
