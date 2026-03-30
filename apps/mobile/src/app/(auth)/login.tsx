import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function LoginScreen() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()

  return (
    <View className="flex-1 bg-base-canvas justify-center items-center px-6">
      <Text className="font-logo text-brand-accent-deep text-5xl mb-2">Velve</Text>
      <Text className="font-sans text-ink-dark text-base mb-12 opacity-60">
        Razmeni garderobu. Otkrij stil.
      </Text>

      {/* Google Sign-In — PRIMARY */}
      <TouchableOpacity
        className="w-full bg-brand-accent-deep py-4 rounded-full items-center mb-4"
        onPress={signInWithGoogle}
      >
        <Text className="font-sans text-base-canvas font-semibold text-base">
          Nastavi sa Google
        </Text>
      </TouchableOpacity>

      {/* Email — SECONDARY */}
      <TouchableOpacity
        className="w-full border border-ink-dark py-4 rounded-full items-center"
        onPress={() => router.push('/(auth)/register')}
      >
        <Text className="font-sans text-ink-dark text-base">
          Nastavi sa emailom
        </Text>
      </TouchableOpacity>
    </View>
  )
}
