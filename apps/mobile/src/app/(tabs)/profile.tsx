import { View, Text } from 'react-native'

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-base-canvas justify-center items-center">
      <Text className="font-display text-ink-dark text-xl">Profil</Text>
      <Text className="font-sans text-ink-dark opacity-40 text-sm mt-2">
        Korisnički profil — Nedelja 2
      </Text>
    </View>
  )
}
