import { View, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

export default function ChatScreen() {
  const { id } = useLocalSearchParams()

  return (
    <View className="flex-1 bg-base-canvas justify-center items-center">
      <Text className="font-display text-ink-dark text-xl">Chat</Text>
      <Text className="font-sans text-ink-dark opacity-40 text-sm mt-2">
        Razgovor ID: {id}
      </Text>
      <Text className="font-sans text-ink-dark opacity-40 text-sm">
        WebSocket chat — Nedelja 3
      </Text>
    </View>
  )
}
