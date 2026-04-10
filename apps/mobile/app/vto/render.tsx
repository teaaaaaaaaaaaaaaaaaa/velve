import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getPrimaryItemImage } from '@/lib/itemImages'

type ItemPayload = {
  _id: string
  title: string
  brand?: string
  category?: string
  images?: string[]
  imageClean?: string | null
  primaryImage?: string | null
}

export default function VtoRenderScreen() {
  const router = useRouter()
  const { itemId } = useLocalSearchParams<{ itemId: string }>()
  const [item, setItem] = useState<ItemPayload | null>(null)
  const [vtoImageUrl, setVtoImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [outfitName, setOutfitName] = useState('Misty Night Out')

  useEffect(() => {
    if (!itemId) {
      router.replace('/vto/select')
      return
    }

    let active = true
    ;(async () => {
      try {
        const [itemResponse, tryOnResponse] = await Promise.all([
          client.get(`/api/items/${itemId}`),
          client.post('/api/vto/try-on', { itemId }),
        ])

        if (!active) return
        setItem(itemResponse.data?.data)
        setVtoImageUrl(tryOnResponse.data?.data?.vtoImageUrl || null)
      } catch (error: any) {
        if (active) {
          Alert.alert(
            'Try-On nije uspeo',
            error?.response?.data?.error || error?.message || 'Pokusaj ponovo za nekoliko trenutaka.',
            [{ text: 'Nazad', onPress: () => router.replace('/vto/select') }]
          )
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

  async function saveOutfit() {
    if (!itemId || !vtoImageUrl) return

    try {
      setSaving(true)
      await client.post('/api/vto/outfits', {
        name: outfitName.trim() || 'Untitled Outfit',
        itemIds: [itemId],
        vtoImageUrl,
      })

      Alert.alert('Sačuvano', 'Outfit je dodat u kolekciju.')
      router.replace({
        pathname: '/vto/hub',
        params: { vtoImageUrl },
      })
    } catch (error: any) {
      Alert.alert(
        'Ne mogu da sačuvam fit',
        error?.response?.data?.error || error?.message || 'Pokusaj ponovo.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <BrandedLoader />
  }

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-5 pb-8 pt-14">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Digitalni snajder
        </Text>
        <Text className="mt-2 font-display text-4xl text-ink-dark">
          Try-On rezultat
        </Text>

        <RemoteImage
          uri={vtoImageUrl || undefined}
          className="mt-6 h-[560px] w-full rounded-[34px] bg-white"
        />

        <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
          <Text className="font-display text-3xl text-ink-dark">Clothes (1 item)</Text>
          <View className="mt-4 flex-row items-center">
            <RemoteImage
              uri={getPrimaryItemImage(item) || undefined}
              className="h-24 w-20 rounded-[20px]"
            />
            <View className="ml-3 flex-1">
              <Text className="font-display text-2xl text-ink-dark">{item?.title}</Text>
              <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                {[item?.brand, item?.category].filter(Boolean).join(' / ')}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
          <Text className="font-display text-3xl text-ink-dark">Sačuvaj fit</Text>
          <TextInput
            value={outfitName}
            onChangeText={setOutfitName}
            placeholder="Misty Night Out"
            placeholderTextColor="#2B2A2B66"
            className="mt-4 rounded-[22px] bg-base-canvas px-4 py-4 font-sans text-sm text-ink-dark"
          />

          <TouchableOpacity
            onPress={saveOutfit}
            disabled={saving}
            className="mt-4 items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.baseCanvas} />
            ) : (
              <Text className="font-sans text-base font-semibold text-base-canvas">
                Sačuvaj u kolekciju
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace({ pathname: '/vto/hub', params: { vtoImageUrl } })}
            className="mt-3 items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-ink-dark">
              Otvori hub
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
