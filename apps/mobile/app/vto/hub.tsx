import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Share, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { BrandWordmark } from '@/components/BrandWordmark'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'

type BodyScanPayload = {
  exists: boolean
  url: string | null
}

type OutfitPayload = {
  _id: string
  name: string
  vtoImageUrl: string
}

export default function VtoHubScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ vtoImageUrl?: string }>()
  const [loading, setLoading] = useState(true)
  const [bodyScan, setBodyScan] = useState<BodyScanPayload>({ exists: false, url: null })
  const [outfits, setOutfits] = useState<OutfitPayload[]>([])
  const [exporting, setExporting] = useState(false)

  async function loadAll() {
    const [bodyScanResponse, outfitsResponse] = await Promise.all([
      client.get('/api/users/body-scan'),
      client.get('/api/vto/outfits'),
    ])

    setBodyScan(bodyScanResponse.data?.data || { exists: false, url: null })
    setOutfits(outfitsResponse.data?.data || [])
  }

  useEffect(() => {
    loadAll()
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [params.vtoImageUrl])

  async function shareImage() {
    const url = params.vtoImageUrl || bodyScan.url
    if (!url) return

    try {
      setExporting(true)
      await Share.share({ message: `Velve Virtual Try-On\n${url}` })
    } catch {
      Alert.alert('Greška', 'Deljenje nije uspelo.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <BrandedLoader />
  }

  if (!bodyScan.exists || !bodyScan.url) {
    router.replace('/vto/body-scan')
    return null
  }

  const currentImage = params.vtoImageUrl || bodyScan.url
  const hasRender = !!params.vtoImageUrl

  return (
    <View className="flex-1 bg-base-canvas px-5 pb-8 pt-14">
      <View className="mb-5 flex-row items-center justify-between">
        <View>
          <Text className="font-logo text-[38px] text-brand-accent-deep">Velve</Text>
          <Text className="font-display text-4xl text-ink-dark">Probna Soba</Text>
        </View>
        <TouchableOpacity
          onPress={shareImage}
          disabled={!hasRender || exporting}
          className={`h-11 w-11 items-center justify-center rounded-full ${hasRender ? 'bg-surface-panel' : 'bg-surface-panel/60'}`}
        >
          <Ionicons name="share-social-outline" size={20} color={colors.inkDark} />
        </TouchableOpacity>
      </View>

      <View collapsable={false} className="overflow-hidden rounded-[34px] bg-white">
        <RemoteImage
          uri={currentImage}
          className="h-[560px] w-full"
        />
        {hasRender ? (
          <View className="absolute bottom-5 right-5 rounded-full bg-base-canvas/90 px-4 py-2">
            <BrandWordmark width={78} />
          </View>
        ) : null}
      </View>

      <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
        <Text className="font-display text-3xl text-ink-dark">Virtual Try-On</Text>
        <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/65">
          {hasRender
            ? 'Poslednji fit je spreman za share ili cuvanje kao outfit.'
            : 'Izaberi jedan digitalizovan artikal da pokrenes novi try-on render.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/vto/select')}
        className="mt-5 items-center rounded-full bg-brand-accent-deep px-4 py-4"
      >
        <Text className="font-sans text-base font-semibold text-base-canvas">
          Odaberi artikal
        </Text>
      </TouchableOpacity>

      {outfits.length > 0 ? (
        <View className="mt-7">
          <Text className="font-display text-3xl text-ink-dark">Kolekcija</Text>
          <View className="mt-4 gap-3">
            {outfits.slice(0, 3).map((outfit) => (
              <View key={outfit._id} className="flex-row items-center rounded-[24px] bg-surface-panel px-3 py-3">
                <RemoteImage
                  uri={outfit.vtoImageUrl}
                  className="h-18 w-14 rounded-[16px]"
                />
                <Text className="ml-3 font-display text-2xl text-ink-dark">{outfit.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}
