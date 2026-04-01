import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function RegisterScreen() {
  console.log('[RegisterScreen] Rendering')
  const router = useRouter()
  const { registerWithEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    console.log('[RegisterScreen] handleRegister called with:', email)
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
      console.log('[RegisterScreen] Registration successful')
      // Root layout automatski redirectuje na /(tabs)/feed nakon uspešnog login-a
    } catch (e: any) {
      console.log('[RegisterScreen] Registration error:', e.code, e.message)
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
      <View className="flex-1 justify-center items-center px-6">
        <Text className="font-logo text-brand-accent-deep text-5xl mb-2">Velve</Text>
        <Text className="font-sans text-ink-dark text-base mb-12 opacity-60">
          Napravi nalog
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
          placeholder="Lozinka (min. 8 karaktera)"
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
          onPress={handleRegister}
          disabled={loading}
        >
          <Text className="font-sans text-base-canvas font-semibold text-base">
            {loading ? 'Registrujem...' : 'Registruj se'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full border border-ink-dark py-4 rounded-full items-center"
          onPress={() => router.back()}
        >
          <Text className="font-sans text-ink-dark text-base">Već imam nalog</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
