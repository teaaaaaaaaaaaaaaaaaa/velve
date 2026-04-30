import { Ionicons } from '@expo/vector-icons'
import { Alert } from '@/lib/velveAlert'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'

export default function CleanCutStartScreen() {
  const router = useRouter()

  function openPreview(imageUri: string) {
    router.push({
      pathname: '/upload-flow/preview',
      params: { imageUri },
    })
  }

  async function openPicker(source: 'camera' | 'gallery') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          Alert.alert('Dozvola', 'Potrebna je dozvola za kameru.')
          return
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
        })

        if (!result.canceled && result.assets[0]?.uri) {
          openPreview(result.assets[0].uri)
        }
        return
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Dozvola', 'Potrebna je dozvola za galeriju.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      })

      if (!result.canceled && result.assets[0]?.uri) {
        openPreview(result.assets[0].uri)
      }
    } catch (error) {
      Alert.alert('Greska', 'Ne mogu da otvorim izbor slike.')
    }
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="flex-1 px-5 pb-10 pt-14">
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/feed')}
          className="mb-6 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
        </TouchableOpacity>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Clean Cut
        </Text>
        <Text className="mt-2 font-display text-4xl text-ink-dark">
          Unos artikla
        </Text>
        <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
          Prvo stvaramo cist digitalni duplikat, pa tek onda ulazimo u listing detalje.
        </Text>

        <GlassSurface className="mt-8 flex-1 items-center justify-center border-dashed border-brand-accent-deep/20 bg-surface-panel/90 px-6 py-8">
          <View className="h-28 w-28 items-center justify-center rounded-[36px] bg-brand-accent-light/25">
            <Ionicons name="sparkles-outline" size={42} color={colors.accentDeep} />
          </View>

          <Text className="mt-6 font-display text-3xl text-ink-dark">
            Digitalizuj komad
          </Text>
          <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/60">
            Za najbolji digitalni duplikat, postavi artikal na ravnu povrsinu pod dobrim svetlom.
          </Text>

          <View className="mt-8 w-full gap-3">
            <TouchableOpacity
              onPress={() => openPicker('gallery')}
              className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
            >
              <Text className="font-sans text-base font-semibold text-base-canvas">
                Izaberi iz galerije
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openPicker('camera')}
              className="items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
            >
              <Text className="font-sans text-base font-semibold text-ink-dark">
                Slikaj kamerom
              </Text>
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </View>
    </View>
  )
}
