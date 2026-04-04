import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function LoginScreen() {
  console.log('[LoginScreen] Rendering')
  const router = useRouter()
  const { signInWithGoogle, signInWithEmail } = useAuth()

  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin() {
    console.log('[LoginScreen] handleEmailLogin called with:', email)
    setError('')

    if (!email || !password) {
      setError('Unesi email i lozinku.')
      return
    }

    setLoading(true)
    try {
      await signInWithEmail(email, password)
      console.log('[LoginScreen] Email login successful')
    } catch (e: any) {
      console.log('[LoginScreen] Email login error:', e.code, e.message)
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        setError('Pogrešan email ili lozinka.')
      } else if (e.code === 'auth/wrong-password') {
        setError('Pogrešna lozinka.')
      } else if (e.code === 'auth/too-many-requests') {
        setError('Previše pokušaja. Pokušaj ponovo kasnije.')
      } else {
        setError('Greška pri prijavi. Pokušaj ponovo.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    console.log('[LoginScreen] Google login pressed')
    try {
      await signInWithGoogle()
    } catch (e: any) {
      console.log('[LoginScreen] Google login error:', e.message)

      // User cancelled - silent return
      if (e.message === 'USER_CANCELLED') {
        return
      }

      // Specific error messages
      let title = 'Google prijava'
      let message = 'Došlo je do greške. Pokušaj ponovo.'

      if (e.message.includes('CLIENT_ID')) {
        message = 'Aplikacija nije pravilno konfigurisana. Kontaktiraj podršku.'
      } else if (e.message === 'NETWORK_ERROR') {
        message = 'Proveri internet konekciju i pokušaj ponovo.'
      } else if (e.message === 'OAUTH_FAILED') {
        message = 'Google prijava nije uspela. Pokušaj ponovo.'
      }

      Alert.alert(title, message)
    }
  }

  // Email login form
  if (showEmailLogin) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-base-canvas"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 justify-center items-center px-6">
          <Text className="font-logo text-brand-accent-deep text-5xl mb-2">Velve</Text>
          <Text className="font-sans text-ink-dark text-base mb-12 opacity-60">
            Prijavi se
          </Text>

          <TextInput
            className="w-full border border-ink-dark rounded-2xl px-4 py-4 font-sans text-ink-dark text-base mb-4"
            placeholder="Email"
            placeholderTextColor="#2B2A2B80"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            className="w-full border border-ink-dark rounded-2xl px-4 py-4 font-sans text-ink-dark text-base mb-2"
            placeholder="Lozinka"
            placeholderTextColor="#2B2A2B80"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text className="font-sans text-sm mb-4 text-center" style={{ color: '#C0392B' }}>
              {error}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          <TouchableOpacity
            className="w-full bg-brand-accent-deep py-4 rounded-full items-center mb-4"
            onPress={handleEmailLogin}
            disabled={loading}
          >
            <Text className="font-sans text-base-canvas font-semibold text-base">
              {loading ? 'Prijavljujem...' : 'Prijavi se'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mb-6"
            onPress={() => { setShowEmailLogin(false); setError('') }}
          >
            <Text className="font-sans text-ink-dark text-sm opacity-60">
              Nazad
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="font-sans text-brand-accent-deep text-sm font-semibold">
              Nemas nalog? Registruj se
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // Main login screen
  return (
    <View className="flex-1 bg-base-canvas justify-center items-center px-6">
      <Text className="font-logo text-brand-accent-deep text-5xl mb-2">Velve</Text>
      <Text className="font-sans text-ink-dark text-base mb-12 opacity-60">
        Razmeni garderobu. Otkrij stil.
      </Text>

      {/* Google Sign-In — PRIMARY */}
      <TouchableOpacity
        className="w-full bg-brand-accent-deep py-4 rounded-full items-center mb-4"
        onPress={handleGoogleLogin}
      >
        <Text className="font-sans text-base-canvas font-semibold text-base">
          Nastavi sa Google
        </Text>
      </TouchableOpacity>

      {/* Email Login — SECONDARY */}
      <TouchableOpacity
        className="w-full border border-ink-dark py-4 rounded-full items-center mb-6"
        onPress={() => setShowEmailLogin(true)}
      >
        <Text className="font-sans text-ink-dark text-base">
          Nastavi sa emailom
        </Text>
      </TouchableOpacity>

      {/* Register link */}
      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text className="font-sans text-brand-accent-deep text-sm font-semibold">
          Nemas nalog? Registruj se
        </Text>
      </TouchableOpacity>
    </View>
  )
}
