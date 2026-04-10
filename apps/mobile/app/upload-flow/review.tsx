import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { GlassSurface } from '@/components/GlassSurface'
import { RemoteImage } from '@/components/RemoteImage'

type ImagesPayload = {
  imageOriginal: string | null
  imageClean: string | null
  isDigitized: boolean
}

export default function CleanCutReviewScreen() {
  const router = useRouter()
  const { itemId } = useLocalSearchParams<{ itemId: string }>()
  const [payload, setPayload] = useState<ImagesPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!itemId) {
      router.replace('/upload-flow')
      return
    }

    let active = true
    ;(async () => {
      try {
        const response = await client.get(`/api/items/${itemId}/images`)
        if (active) {
          setPayload(response.data?.data)
        }
      } catch (error) {
        if (active) {
          Alert.alert('Ne mogu da ucitam rezultat', 'Pokusaj ponovo.', [
            { text: 'Nazad', onPress: () => router.replace('/upload-flow') },
          ])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [itemId, router])

  async function retryFlow() {
    try {
      if (itemId) {
        await client.delete(`/api/items/${itemId}`)
      }
    } catch {
      // ignore cleanup failures for retry
    } finally {
      router.replace('/upload-flow')
    }
  }

  if (loading) {
    return <BrandedLoader />
  }

  return (
    <View className="flex-1 bg-base-canvas px-5 pb-8 pt-14">
      <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
        Final review
      </Text>
      <Text className="mt-2 font-display text-4xl text-ink-dark">
        Izgleda li ovo kao tvoj komad?
      </Text>

      <View className="mt-8 flex-row gap-3">
        <GlassSurface className="flex-1 px-3 py-3">
          <Text className="mb-3 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
            Original
          </Text>
          <RemoteImage
            uri={payload?.imageOriginal || undefined}
            className="h-[260px] w-full rounded-[26px]"
          />
        </GlassSurface>

        <GlassSurface className="flex-1 px-3 py-3">
          <Text className="mb-3 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
            Clean cut
          </Text>
          <RemoteImage
            uri={payload?.imageClean || undefined}
            className="h-[260px] w-full rounded-[26px]"
          />
        </GlassSurface>
      </View>

      <View className="mt-6 rounded-[26px] bg-surface-panel px-4 py-4">
        <Text className="font-sans text-sm leading-6 text-ink-dark/70">
          Obe verzije se cuvaju u arhivu. Clean varijanta ce se prikazivati kroz closet i postaje osnov za Virtual Try-On.
        </Text>
      </View>

      <TouchableOpacity
        className="mt-auto items-center rounded-full bg-brand-accent-deep px-4 py-4"
        onPress={() =>
          router.replace({
            pathname: '/upload-flow/details',
            params: { itemId },
          })
        }
      >
        <Text className="font-sans text-base font-semibold text-base-canvas">
          Savrseno, nastavi
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-3 items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
        onPress={retryFlow}
      >
        <Text className="font-sans text-base font-semibold text-ink-dark">
          Probaj ponovo
        </Text>
      </TouchableOpacity>
    </View>
  )
}
