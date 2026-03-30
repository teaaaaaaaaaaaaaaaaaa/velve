import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'

export default function RegisterScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 bg-base-canvas justify-center items-center px-6">
      <Text className="font-display text-ink-dark text-2xl mb-8">Registracija</Text>

      {/* TODO: Nedelja 1 — dodati email/password formu */}
      <Text className="font-sans text-ink-dark opacity-60 text-center mb-8">
        Email/password registracija dolazi u Nedelji 1.
      </Text>

      <TouchableOpacity
        className="w-full border border-ink-dark py-4 rounded-full items-center"
        onPress={() => router.back()}
      >
        <Text className="font-sans text-ink-dark text-base">Nazad</Text>
      </TouchableOpacity>
    </View>
  )
}
