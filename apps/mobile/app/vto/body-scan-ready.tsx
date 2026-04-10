import { useRouter } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'

export default function BodyScanReadyScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="flex-1 items-center justify-center px-5">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Tvoj digitalni duplikat
        </Text>
        <Text className="mt-3 text-center font-display text-4xl text-ink-dark">
          Tvoj digitalni duplikat je spreman.
        </Text>
        <Text className="mt-4 text-center font-sans text-sm leading-7 text-ink-dark/65">
          Body scan je sacuvan jednom i bice osnova za svaki sledeci Virtual Try-On render.
        </Text>

        <TouchableOpacity
          onPress={() => router.replace('/vto/hub')}
          className="mt-8 items-center rounded-full bg-brand-accent-deep px-5 py-4"
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            Uđi u Velve arhiv
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
