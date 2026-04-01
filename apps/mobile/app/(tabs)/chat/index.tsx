import { View, Text } from 'react-native'

export default function ChatListScreen() {
  return (
    <View className="flex-1 bg-base-canvas justify-center items-center">
      <Text className="font-display text-ink-dark text-xl">Chat</Text>
      <Text className="font-sans text-ink-dark opacity-40 text-sm mt-2">
        Lista razgovora — Nedelja 3
      </Text>
    </View>
  )
}
