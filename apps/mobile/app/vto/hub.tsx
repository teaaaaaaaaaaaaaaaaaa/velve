import { Ionicons } from '@expo/vector-icons'
import { Alert } from '@/lib/velveAlert'
import * as FileSystem from 'expo-file-system/legacy'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import * as Sharing from 'expo-sharing'

import client from '@/api/client'
import { BrandWordmark } from '@/components/BrandWordmark'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { hasSkippedBodyScanThisSession } from '@/lib/vtoSession'

type BodyScanPayload = {
  exists: boolean
  url: string | null
}

type OutfitPayload = {
  _id: string
  name: string
  vtoImageUrl: string
  isChainRender?: boolean
  chainSteps?: number
}

function OutfitRow({
  outfit,
  deleting,
  onDelete,
}: {
  outfit: OutfitPayload
  deleting: boolean
  onDelete: () => void
}) {
  const translateX = useRef(new Animated.Value(0)).current
  const openedRef = useRef(false)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          translateX.setValue(Math.max(gesture.dx, -86))
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dx < -54
        openedRef.current = shouldOpen
        Animated.spring(translateX, {
          toValue: shouldOpen ? -72 : 0,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  return (
    <View className="overflow-hidden rounded-[24px] bg-signal-danger/10">
      <View className="absolute bottom-0 right-0 top-0 w-[76px] items-center justify-center">
        <TouchableOpacity
          onPress={onDelete}
          disabled={deleting}
          className="h-11 w-11 items-center justify-center rounded-full bg-signal-danger"
        >
          <Ionicons name={deleting ? 'hourglass-outline' : 'trash-outline'} size={18} color={colors.baseCanvas} />
        </TouchableOpacity>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
        className="flex-row items-center rounded-[24px] bg-surface-panel px-3 py-3"
      >
        <RemoteImage uri={outfit.vtoImageUrl} className="h-18 w-14 rounded-[16px]" />
        <View className="ml-3 flex-1">
          <Text className="font-display text-2xl text-ink-dark">{outfit.name}</Text>
          <Text className="mt-1 font-sans text-xs text-ink-dark/55">
            {outfit.isChainRender ? `Chain render u ${outfit.chainSteps || 1} koraka` : 'Prevuci ulevo za brisanje'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          disabled={deleting}
          className="ml-3 h-11 w-11 items-center justify-center rounded-full bg-base-canvas"
        >
          <Ionicons name={deleting ? 'hourglass-outline' : 'trash-outline'} size={18} color={colors.inkDark} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

function VtoHubSkeleton() {
  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 56 }}
    >
      <View className="mb-5 flex-row items-center justify-between">
        <View>
          <View className="h-8 w-28 rounded-full bg-surface-panel" />
          <View className="mt-3 h-10 w-44 rounded-full bg-surface-panel" />
        </View>
        <View className="h-11 w-11 rounded-full bg-surface-panel" />
      </View>
      <View className="h-[560px] rounded-[34px] bg-surface-panel" />
      <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
        <View className="h-7 w-40 rounded-full bg-base-canvas" />
        <View className="mt-4 h-4 w-full rounded-full bg-base-canvas" />
        <View className="mt-3 h-4 w-2/3 rounded-full bg-base-canvas" />
      </View>
      <View className="mt-5 h-14 rounded-full bg-surface-panel" />
      <View className="mt-7 h-28 rounded-[28px] bg-surface-panel" />
    </ScrollView>
  )
}

export default function VtoHubScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ vtoImageUrl?: string }>()
  const [loading, setLoading] = useState(true)
  const [bodyScan, setBodyScan] = useState<BodyScanPayload>({ exists: false, url: null })
  const [outfits, setOutfits] = useState<OutfitPayload[]>([])
  const [exporting, setExporting] = useState(false)
  const [deletingOutfitId, setDeletingOutfitId] = useState<string | null>(null)

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

    async function shareUrlFallback() {
      await Share.share({ message: `Velve Virtual Try-On\n${url}` })
    }

    try {
      setExporting(true)
      const sharingAvailable = await Sharing.isAvailableAsync()
      const cacheDirectory = FileSystem.cacheDirectory || ''

      if (!sharingAvailable || !cacheDirectory) {
        await shareUrlFallback()
        return
      }

      const extensionMatch = url.match(/\.(png|jpg|jpeg|webp)(?:\?|$)/i)
      const fileExtension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : '.png'
      const localUri = `${cacheDirectory}velve-vto-${Date.now()}${fileExtension}`

      await FileSystem.downloadAsync(url, localUri)
      await Sharing.shareAsync(localUri)
    } catch {
      try {
        await shareUrlFallback()
      } catch {
        Alert.alert('Greska', 'Deljenje nije uspelo.')
      }
    } finally {
      setExporting(false)
    }
  }

  function deleteOutfit(outfitId: string) {
    Alert.alert('Obrisi outfit', 'Ovaj sacuvani outfit ce biti uklonjen iz kolekcije.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Obrisi',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingOutfitId(outfitId)
            await client.delete(`/api/vto/outfits/${outfitId}`)
            setOutfits((prev) => prev.filter((outfit) => outfit._id !== outfitId))
          } catch (error: any) {
            Alert.alert(
              'Brisanje nije uspelo',
              error?.response?.data?.error || error?.message || 'Pokusaj ponovo.'
            )
          } finally {
            setDeletingOutfitId(null)
          }
        },
      },
    ])
  }

  if (loading) {
    return <VtoHubSkeleton />
  }

  const hasBodyScan = Boolean(bodyScan.exists && bodyScan.url)
  const skippedBodyScan = hasSkippedBodyScanThisSession()
  const currentImage = params.vtoImageUrl || bodyScan.url || null
  const hasRender = !!params.vtoImageUrl
  const openOverflowMenu = () => {
    const actions = [
      ...(hasRender
        ? [{ text: exporting ? 'Deljenje...' : 'Podeli trenutni render', onPress: shareImage }]
        : []),
      {
        text: hasBodyScan ? 'Napravi novi outfit' : 'Napravi body scan',
        onPress: () => router.push(hasBodyScan ? '/vto/select' : '/vto/body-scan'),
      },
      { text: 'Body scan', onPress: () => router.push('/vto/body-scan') },
      { text: 'Odustani', style: 'cancel' as const },
    ]

    Alert.alert('VTO opcije', hasRender ? 'Izaberi akciju za trenutni render.' : 'Prvo napravi outfit, pa ce deljenje biti dostupno.', actions)
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 56 }}
    >
      <View className="mb-5 flex-row items-center justify-between">
        <View>
          <Text className="font-logo text-[38px] text-brand-accent-deep">Velve</Text>
          <Text className="font-display text-4xl text-ink-dark">Probna Soba</Text>
        </View>
        <TouchableOpacity
          onPress={openOverflowMenu}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.inkDark} />
        </TouchableOpacity>
      </View>

      {currentImage ? (
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
      ) : (
        <View className="rounded-[34px] bg-surface-panel px-5 py-7">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-highlight/35">
            <Ionicons name="body-outline" size={30} color={colors.inkDark} />
          </View>
          <Text className="mt-5 font-display text-4xl text-ink-dark">Body scan nije dodat</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
            {skippedBodyScan
              ? 'Preskocio si body scan u ovoj sesiji, pa te Hub vise ne vraca automatski nazad. Mozes ga dodati kad budes spreman.'
              : 'Virtual Try-On najbolje radi kada postoji jedna jasna fotografija celog tela. Hub ostaje otvoren, a scan mozes pokrenuti kad god zelis.'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/vto/body-scan')}
            className="mt-6 items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">Napravi body scan</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-4">
        <Text className="font-display text-3xl text-ink-dark">Virtual Try-On</Text>
        <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/65">
          {hasRender
            ? 'Poslednji fit je spreman za share ili cuvanje kao outfit.'
            : 'Izaberi jedan ili vise digitalizovanih komada da pokrenes novi try-on render.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push(hasBodyScan ? '/vto/select' : '/vto/body-scan')}
        className={`mt-5 items-center rounded-full px-4 py-4 ${hasBodyScan ? 'bg-brand-accent-deep' : 'bg-brand-highlight'}`}
      >
        <Text className={`font-sans text-base font-semibold ${hasBodyScan ? 'text-base-canvas' : 'text-ink-dark'}`}>
          {hasBodyScan ? 'Odaberi artikal' : 'Dodaj body scan'}
        </Text>
      </TouchableOpacity>

      {outfits.length > 0 ? (
        <View className="mt-7">
          <Text className="font-display text-3xl text-ink-dark">Kolekcija</Text>
          <View className="mt-4 gap-3">
            {outfits.map((outfit) => (
              <OutfitRow
                key={outfit._id}
                outfit={outfit}
                deleting={deletingOutfitId === outfit._id}
                onDelete={() => deleteOutfit(outfit._id)}
              />
            ))}
          </View>
        </View>
      ) : (
        <View className="mt-7 rounded-[28px] bg-surface-panel px-5 py-5">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-highlight/35">
            <Ionicons name="sparkles-outline" size={24} color={colors.inkDark} />
          </View>
          <Text className="mt-4 font-display text-3xl text-ink-dark">Stvori prvi outfit</Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/62">
            Kolekcija je prazna dok ne sacuvas prvi render. Kreni kroz tri kratka koraka.
          </Text>
          <View className="mt-4 gap-3">
            {['Izaberi digitalizovan komad', 'Pokreni Virtual Try-On render', 'Sacuvaj rezultat u kolekciju'].map((step, index) => (
              <View key={step} className="flex-row items-center rounded-[18px] bg-base-canvas px-4 py-3">
                <Text className="font-display text-xl text-brand-accent-deep">{index + 1}</Text>
                <Text className="ml-3 flex-1 font-sans text-sm text-ink-dark/70">{step}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => router.push(hasBodyScan ? '/vto/select' : '/vto/body-scan')}
            className="mt-5 items-center rounded-full bg-brand-highlight px-4 py-4"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark">
              {hasBodyScan ? 'Stvori prvi outfit' : 'Prvo dodaj body scan'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}
