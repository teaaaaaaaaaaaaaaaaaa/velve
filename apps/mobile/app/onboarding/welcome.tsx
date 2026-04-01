import { View, Text, TouchableOpacity, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />

      {/* Progress Bar */}
      <View className="px-6 pt-16 pb-8">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-ink-dark font-sans text-sm">Korak 1 od 5</Text>
        </View>
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '20%' }} />
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 justify-center">
        <View className="mb-12">
          <Text className="text-6xl font-logo text-brand-accent-deep mb-4">
            Velve
          </Text>
          <Text className="text-4xl font-display text-ink-dark mb-6 leading-tight">
            Dobrodošli u{'\n'}budućnost mode
          </Text>
          <Text className="text-lg font-sans text-ink-dark/70 leading-relaxed">
            Peer-to-peer platforma za razmenu garderobe.{'\n'}
            Podelite svoj stil, otkrijte nove komade,{'\n'}
            povežite se sa zajednicom.
          </Text>
        </View>

        {/* Decorative Element */}
        <View className="absolute right-0 top-20 w-32 h-32 bg-brand-highlight/20 rounded-full -mr-16" />
        <View className="absolute left-0 bottom-40 w-24 h-24 bg-brand-accent-light/20 rounded-full -ml-12" />
      </View>

      {/* CTA Button */}
      <View className="px-6 pb-12">
        <TouchableOpacity
          className="bg-brand-accent-deep rounded-full py-4 items-center active:opacity-80"
          onPress={() => router.push('/onboarding/style')}
        >
          <Text className="text-base-canvas font-sans text-lg font-semibold">
            Počni
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
