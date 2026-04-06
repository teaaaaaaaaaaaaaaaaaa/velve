import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

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
  const { registerWithEmail } = useAuth()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        setError('Ovaj email je već registrovan.')
      } else if (e.code === 'auth/invalid-email') {
        setError('Neispravan email format.')
      } else {
        setError('Greška pri registraciji. Pokušaj ponovo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BrandBackground />

      <View className="flex-1 px-gutter pb-10 pt-16">
        <View className="flex-1 justify-between">
          <View className="pt-4">
            <BrandWordmark width={180} />
            <Text className="mt-5 font-logo text-[34px] leading-none text-brand-accent-deep/70">
              join the swap scene
            </Text>
            <Text className="mt-4 font-display text-[40px] leading-[42px] text-ink-dark">
              {t('auth.registerTitle')}
            </Text>
            <Text className="mt-4 max-w-[320px] font-sans text-base leading-7 text-ink-dark/68">
              {t('auth.registerDescription')}
            </Text>
          </View>

          <GlassSurface className="px-5 py-5">
            <TextInput
              className="mb-4 rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.mutedText}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              className="rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
              placeholder={t('auth.passwordLongPlaceholder')}
              placeholderTextColor={colors.mutedText}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
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
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
