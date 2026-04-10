import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getPrimaryItemImage, hasDigitizedImage } from '@/lib/itemImages'

type ClosetBucket = 'live' | 'drafts' | 'archive'

type ClosetItem = {
  _id: string
  title: string
  images?: string[]
  imageClean?: string | null
  primaryImage?: string | null
  isDigitized?: boolean
  brand?: string
  size?: string
  status: string
  archiveStatus?: string | null
  listingType?: 'sell' | 'trade' | 'both'
}

type ClosetPayload = {
  live: ClosetItem[]
  drafts: ClosetItem[]
  archive: ClosetItem[]
}

const BUCKET_META: Record<ClosetBucket, { title: string; description: string }> = {
  live: {
    title: 'Live closet',
    description: 'Aktivne objave koje su trenutno vidljive u discovery feedu.',
  },
  drafts: {
    title: 'Drafts',
    description: 'Komadi koje jos doterujes pre objave.',
  },
  archive: {
    title: 'Archive',
    description: 'Prodati, zamenjeni i arhivirani komadi za pregled istorije.',
  },
}

function getStatusLabel(item: ClosetItem) {
  if (item.archiveStatus === 'deleted') return 'Deleted'
  if (item.archiveStatus === 'sold') return 'Sold'
  if (item.archiveStatus === 'swapped') return 'Swapped'
  if (item.status === 'pending_trade') return 'Pending'
  if (item.status === 'unavailable') return 'Paused'
  if (item.status === 'draft') return 'Draft'
  if (item.status === 'archived') return 'Archived'
  return 'Available'
}

function getStatusTone(item: ClosetItem) {
  if (item.archiveStatus === 'sold' || item.archiveStatus === 'swapped') {
    return 'bg-brand-highlight text-ink-dark'
  }

  if (item.status === 'pending_trade') return 'bg-brand-accent-light/30 text-brand-accent-deep'
  if (item.status === 'draft') return 'bg-base-canvas text-ink-dark'
  if (item.status === 'unavailable' || item.status === 'archived' || item.archiveStatus === 'deleted') {
    return 'bg-surface-panel text-ink-dark'
  }

  return 'bg-brand-highlight text-ink-dark'
}

const ClosetCard = memo(function ClosetCard({
  item,
  onOpen,
  onQuickAction,
  quickActionLabel,
  onDigitize,
}: {
  item: ClosetItem
  onOpen: () => void
  onQuickAction?: () => void
  quickActionLabel?: string | null
  onDigitize?: () => void
}) {
  const tone = getStatusTone(item).split(' ')

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpen}
      className="mb-4 overflow-hidden rounded-[28px] border border-ink-dark/5 bg-surface-panel px-4 py-4"
      style={{
        shadowColor: colors.inkDark,
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      }}
    >
      <View className="flex-row">
        <View className="mr-4 h-28 w-24 overflow-hidden rounded-[20px] bg-base-canvas">
          {getPrimaryItemImage(item) ? (
            <RemoteImage
              uri={getPrimaryItemImage(item) || undefined}
              className="h-full w-full"
              fallback={
                <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
                  <Ionicons name="shirt-outline" size={26} color={colors.accentDeep} />
                </View>
              }
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
              <Ionicons name="shirt-outline" size={26} color={colors.accentDeep} />
            </View>
          )}
        </View>

        <View className="flex-1">
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-display text-2xl text-ink-dark" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                {[item.brand, item.size ? item.size.toUpperCase() : null]
                  .filter(Boolean)
                  .join(' / ') || 'Bez dodatnih detalja'}
              </Text>
            </View>

            <View className={`rounded-full px-3 py-2 ${tone[0]}`}>
              <Text className={`font-sans text-xs font-semibold ${tone[1]}`}>
                {getStatusLabel(item)}
              </Text>
            </View>
          </View>

          <View className="mb-3 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-base-canvas px-3 py-2">
              <Text className="font-sans text-xs text-ink-dark/70">
                {item.listingType === 'both'
                  ? 'Trade + sell'
                  : item.listingType === 'sell'
                    ? 'Sell'
                    : 'Trade'}
              </Text>
            </View>

            {item.isDigitized ? (
              <View className="rounded-full bg-brand-highlight px-3 py-2">
                <Text className="font-sans text-xs font-semibold text-ink-dark">
                  Clean Cut ready
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={onOpen}
              className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
            >
              <Text className="font-sans text-xs font-semibold text-ink-dark">Otvori</Text>
            </TouchableOpacity>

            {onQuickAction && quickActionLabel ? (
              <TouchableOpacity
                onPress={onQuickAction}
                className="rounded-full bg-brand-accent-deep px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-base-canvas">
                  {quickActionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            {!item.isDigitized && onDigitize ? (
              <TouchableOpacity
                onPress={onDigitize}
                className="rounded-full bg-brand-highlight px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">
                  Clean Cut
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
})

export default function ClosetScreen() {
  const router = useRouter()

  const [closet, setCloset] = useState<ClosetPayload>({
    live: [],
    drafts: [],
    archive: [],
  })
  const [activeBucket, setActiveBucket] = useState<ClosetBucket>('live')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [digitizingItemId, setDigitizingItemId] = useState<string | null>(null)

  const visibleItems = closet[activeBucket]
  const hasReadyForVto = useMemo(
    () => [...closet.live, ...closet.drafts].some((item) => hasDigitizedImage(item)),
    [closet]
  )

  const loadCloset = useCallback(async () => {
    const response = await client.get('/api/items/closet')
    if (response.data.ok) {
      setCloset(response.data.data as ClosetPayload)
    }
  }, [])

  useEffect(() => {
    loadCloset()
      .catch(() => {
        Alert.alert('Greska', 'Closet trenutno nije moguce ucitati.')
      })
      .finally(() => setLoading(false))
  }, [loadCloset])

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await loadCloset()
    } finally {
      setRefreshing(false)
    }
  }, [loadCloset])

  const withMutation = useCallback(
    async (callback: () => Promise<void>) => {
      try {
        setSubmitting(true)
        await callback()
        await loadCloset()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Promena nije uspela.'
        Alert.alert('Greska', message)
      } finally {
        setSubmitting(false)
      }
    },
    [loadCloset]
  )

  const bucketCounts = useMemo(
    () => ({
      live: closet.live.length,
      drafts: closet.drafts.length,
      archive: closet.archive.length,
    }),
    [closet]
  )

  const quickActionLabel = useCallback((item: ClosetItem) => {
    if (item.status === 'draft') return 'Objavi'
    if (item.status === 'available') return 'Pauziraj'
    if (item.status === 'unavailable' || item.status === 'archived') return 'Vrati live'
    return null
  }, [])

  const handleQuickAction = useCallback(
    async (item: ClosetItem) => {
      await withMutation(async () => {
        const nextStatus =
          item.status === 'draft'
            ? 'available'
            : item.status === 'available'
              ? 'unavailable'
              : 'available'

        await client.put(`/api/items/${item._id}/status`, { status: nextStatus })
      })
    },
    [withMutation]
  )

  const handleDigitize = useCallback(
    async (item: ClosetItem) => {
      try {
        setDigitizingItemId(item._id)
        await client.post(`/api/items/${item._id}/digitize`)
        await loadCloset()
      } catch (error: any) {
        Alert.alert(
          'Clean Cut nije uspeo',
          error?.response?.data?.error || error?.message || 'Pokusaj ponovo za nekoliko trenutaka.'
        )
      } finally {
        setDigitizingItemId(null)
      }
    },
    [loadCloset]
  )

  const renderClosetItem = useCallback(
    ({ item }: { item: ClosetItem }) => (
      <View className="px-5">
        <ClosetCard
          item={item}
          onOpen={() => router.push(`/items/${item._id}`)}
          onQuickAction={
            quickActionLabel(item) && item.status !== 'pending_trade'
              ? () => handleQuickAction(item)
              : undefined
          }
          quickActionLabel={quickActionLabel(item)}
          onDigitize={!item.isDigitized && !digitizingItemId ? () => handleDigitize(item) : undefined}
        />
      </View>
    ),
    [digitizingItemId, handleDigitize, handleQuickAction, quickActionLabel, router]
  )

  const closetHeader = useMemo(
    () => (
      <View className="px-5 pt-14">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              Closet
            </Text>
            <Text className="font-display text-4xl text-ink-dark">Moj closet</Text>
          </View>
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View
          className="mb-6 overflow-hidden rounded-[28px] border border-brand-accent-deep/10 bg-surface-panel px-4 py-4"
          style={{
            shadowColor: colors.inkDark,
            shadowOpacity: 0.06,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Text className="font-sans text-sm leading-6 text-ink-dark/70">
            Sve objave su sada na jednom jednostavnom mestu: live, drafts i archive.
          </Text>

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-3"
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Text className="font-sans text-sm font-semibold text-base-canvas">Nova objava</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 items-center rounded-full px-4 py-3 ${hasReadyForVto ? 'bg-brand-highlight' : 'bg-brand-highlight/35'}`}
              disabled={!hasReadyForVto}
              onPress={() => router.push('/vto/archive')}
            >
              <Text className={`font-sans text-sm font-semibold ${hasReadyForVto ? 'text-ink-dark' : 'text-ink-dark/45'}`}>
                Magično Isprobaj
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-6 flex-row rounded-[24px] bg-surface-panel p-2">
          {(['live', 'drafts', 'archive'] as ClosetBucket[]).map((bucket) => (
            <TouchableOpacity
              key={bucket}
              onPress={() => setActiveBucket(bucket)}
              className={`flex-1 rounded-[18px] px-3 py-3 ${bucket === activeBucket ? 'bg-brand-accent-deep' : ''}`}
            >
              <Text
                className={`text-center font-sans text-sm font-semibold ${
                  bucket === activeBucket ? 'text-base-canvas' : 'text-ink-dark/60'
                }`}
              >
                {bucket === 'live'
                  ? `Live (${bucketCounts.live})`
                  : bucket === 'drafts'
                    ? `Drafts (${bucketCounts.drafts})`
                    : `Archive (${bucketCounts.archive})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-5 px-0">
          <Text className="font-display text-3xl text-ink-dark">{BUCKET_META[activeBucket].title}</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
            {BUCKET_META[activeBucket].description}
          </Text>
        </View>
      </View>
    ),
    [activeBucket, bucketCounts, hasReadyForVto, router]
  )

  if (loading) {
    return <BrandedLoader />
  }

  return (
    <FlatList
      className="flex-1 bg-base-canvas"
      data={visibleItems}
      keyExtractor={(item) => item._id}
      renderItem={renderClosetItem}
      ListHeaderComponent={closetHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EditorialEmptyState
            icon={activeBucket === 'drafts' ? 'document-text-outline' : 'shirt-outline'}
            title={
              activeBucket === 'live'
                ? 'Live closet je prazan'
                : activeBucket === 'drafts'
                  ? 'Nema draft komada'
                  : 'Archive jos nema komade'
            }
            description={
              activeBucket === 'live'
                ? 'Objavi komad ili vrati arhivirani item nazad u aktivni closet.'
                : activeBucket === 'drafts'
                  ? 'Sacuvaj nedovrsenu objavu kao draft i vrati joj se kasnije.'
                  : 'Kada prodas, zamenis ili arhiviras komad, ovde ostaje pregled.'
            }
            actionLabel={activeBucket === 'archive' ? undefined : 'Dodaj objavu'}
            onAction={activeBucket === 'archive' ? undefined : () => router.push('/(tabs)/upload')}
          />
        </View>
      }
      ListFooterComponent={
        submitting || digitizingItemId ? (
          <View className="py-2">
            <Text className="text-center font-sans text-sm text-ink-dark/55">
              {digitizingItemId ? 'Clean Cut digitalizuje komad...' : 'Azuriram closet...'}
            </Text>
          </View>
        ) : null
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
    />
  )
}
