import { View, Text } from 'react-native'

export default function FeedScreen() {
  return (
    <View className="flex-1 bg-base-canvas justify-center items-center">
      <Text className="font-display text-ink-dark text-xl">Feed</Text>
      <Text className="font-sans text-ink-dark opacity-40 text-sm mt-2">
        TikTok-style swipe feed — Nedelja 2
      </Text>
    </View>
  )
}
