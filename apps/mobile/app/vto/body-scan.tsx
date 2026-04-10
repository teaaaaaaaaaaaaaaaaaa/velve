import { useRouter } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'

export default function BodyScanIntroScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="flex-1 justify-between px-5 pb-10 pt-16">
        <View>
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            Ritual skenera
          </Text>
          <Text className="mt-3 font-display text-4xl text-ink-dark">
            Da bi isprobao arhiv, potreban nam je tvoj digitalni duplikat.
          </Text>
          <Text className="mt-4 font-sans text-sm leading-7 text-ink-dark/65">
            Pronadji cistu, belu pozadinu sa dobrim svetlom. Procedura je anonimna i slika se cuva samo kao body scan za Virtual Try-On.
          </Text>
        </View>

        <View className="rounded-[32px] bg-surface-panel px-5 py-6">
          <Text className="font-display text-3xl text-ink-dark">Priprema</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
            Stani ispred kamere celim telom, drzi telefon mirno i ostavi malo praznog prostora iznad glave i oko ramena.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/vto/body-scan-camera')}
          className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            Započni skener
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
