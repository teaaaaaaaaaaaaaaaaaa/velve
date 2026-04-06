import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'

type ClosetBucket = 'live' | 'drafts' | 'archive'

type ClosetItem = {
  _id: string
  title: string
  images?: string[]
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
    description: 'Aktivne objave, komadi na pauzi i oni koji su trenutno u pending trade toku.',
  },
  drafts: {
    title: 'Drafts',
    description: 'Nedovrseni komadi koje mozes da doradis pre nego sto izadju u discovery.',
  },
  archive: {
    title: 'Archive',
    description: 'Prodati, zamenjeni, arhivirani i obrisani komadi kao zatvoreni chapter.',
  },
}

function getStatusLabel(item: ClosetItem) {
  if (item.archiveStatus === 'deleted') return 'Deleted'
  if (item.archiveStatus === 'sold') return 'Sold'
  if (item.archiveStatus === 'swapped') return 'Swapped'
  if (item.status === 'pending_trade') return 'Pending trade'
  if (item.status === 'unavailable') return 'Unavailable'
  if (item.status === 'draft') return 'Draft'
  if (item.status === 'archived') return 'Archived'
  return 'Available'
}

function getStatusTone(item: ClosetItem) {
  if (item.archiveStatus === 'deleted') return 'bg-surface-panel text-brand-accent-deep'
  if (item.archiveStatus === 'sold' || item.archiveStatus === 'swapped') {
    return 'bg-brand-highlight text-ink-dark'
  }
  if (item.status === 'pending_trade') return 'bg-brand-accent-light/30 text-brand-accent-deep'
  if (item.status === 'draft') return 'bg-base-canvas text-ink-dark'
  if (item.status === 'unavailable' || item.status === 'archived') {
    return 'bg-surface-panel text-ink-dark'
  }
  return 'bg-brand-highlight text-ink-dark'
}

function ClosetCard({
  item,
  selectable,
  selected,
  onToggleSelect,
  onOpen,
  onMoveUp,
  onMoveDown,
  onQuickAction,
  quickActionLabel,
}: {
  item: ClosetItem
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onQuickAction?: () => void
  quickActionLabel?: string | null
}) {
  const tone = getStatusTone(item).split(' ')

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={selectable ? onToggleSelect : onOpen}
      onLongPress={onToggleSelect}
      className={`mb-4 overflow-hidden rounded-[28px] border px-4 py-4 ${selected ? 'border-brand-accent-deep bg-brand-accent-deep/5' : 'border-ink-dark/5 bg-surface-panel'}`}
      style={selected ? undefined : { shadowColor: '#2B2A2B', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
    >
      <View className="flex-row">
        <View className="relative mr-4 h-28 w-24 overflow-hidden rounded-[20px] bg-base-canvas">
          {item.images?.[0] ? (
            <RemoteImage
              uri={item.images[0]}
              className="h-full w-full"
              fallback={
                <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
                  <Ionicons name="shirt-outline" size={26} color="#431A43" />
                </View>
              }
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
              <Ionicons name="shirt-outline" size={26} color="#431A43" />
            </View>
          )}

          {selectable ? (
            <View className="absolute left-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-base-canvas">
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color="#431A43" />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color="#431A43" />
              )}
            </View>
          ) : null}
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
          </View>

          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={onOpen}
              className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
            >
              <Text className="font-sans text-xs font-semibold text-ink-dark">Open</Text>
            </TouchableOpacity>

            {onQuickAction ? (
              <TouchableOpacity
                onPress={onQuickAction}
                className="rounded-full bg-brand-accent-deep px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-base-canvas">
                  {quickActionLabel || 'Quick action'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {onMoveUp ? (
              <TouchableOpacity
                onPress={onMoveUp}
                className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">Up</Text>
              </TouchableOpacity>
            ) : null}

            {onMoveDown ? (
              <TouchableOpacity
                onPress={onMoveDown}
                className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">Down</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const visibleItems = closet[activeBucket]
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.includes(item._id)),
    [selectedIds, visibleItems]
  )
  const hasLockedSelection = selectedItems.some((item) => item.status === 'pending_trade')

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
        setSelectionMode(false)
        setSelectedIds([])
      }
    },
    [loadCloset]
  )

  const toggleSelect = useCallback((itemId: string) => {
    setSelectionMode(true)
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((entry) => entry !== itemId) : [...prev, itemId]
    )
  }, [])

  const bucketCounts = useMemo(
    () => ({
      live: closet.live.length,
      drafts: closet.drafts.length,
      archive: closet.archive.length,
    }),
    [closet]
  )

  const runSingleStatus = useCallback(
    async (itemId: string, status: string) => {
      await withMutation(async () => {
        await client.put(`/api/items/${itemId}/status`, { status })
      })
    },
    [withMutation]
  )

  const runBulk = useCallback(
    async (action: 'publish' | 'available' | 'unavailable' | 'archive' | 'delete' | 'draft') => {
      if (selectedIds.length === 0) return

      await withMutation(async () => {
        await client.put('/api/items/closet/bulk', {
          itemIds: selectedIds,
          action,
        })
      })
    },
    [selectedIds, withMutation]
  )

  const reorderWithinBucket = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      const bucketItems = [...closet[activeBucket]]
      const index = bucketItems.findIndex((item) => item._id === itemId)
      const nextIndex = index + direction

      if (index < 0 || nextIndex < 0 || nextIndex >= bucketItems.length) {
        return
      }

      const [moved] = bucketItems.splice(index, 1)
      bucketItems.splice(nextIndex, 0, moved)

      const orderedIds =
        activeBucket === 'live'
          ? [...bucketItems.map((item) => item._id), ...closet.drafts.map((item) => item._id)]
          : [...closet.live.map((item) => item._id), ...bucketItems.map((item) => item._id)]

      await withMutation(async () => {
        await client.put('/api/items/closet/reorder', {
          itemIds: orderedIds,
        })
      })
    },
    [activeBucket, closet, withMutation]
  )

  const quickActionLabel = useCallback((item: ClosetItem) => {
    if (item.status === 'draft') return 'Publish'
    if (item.status === 'available') return 'Pause'
    if (item.status === 'unavailable') return 'Go live'
    if (item.status === 'archived') return 'Restore'
    return null
  }, [])

  const handleQuickAction = useCallback(
    async (item: ClosetItem) => {
      if (item.status === 'draft') {
        await runSingleStatus(item._id, 'available')
        return
      }

      if (item.status === 'available') {
        await runSingleStatus(item._id, 'unavailable')
        return
      }

      if (item.status === 'unavailable' || item.status === 'archived') {
        await runSingleStatus(item._id, 'available')
      }
    },
    [runSingleStatus]
  )

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <View className="px-5 pb-8 pt-14">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              Closet management
            </Text>
            <Text className="font-display text-4xl text-ink-dark">Moj closet</Text>
          </View>
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={22} color="#2B2A2B" />
          </TouchableOpacity>
        </View>

        <View className="mb-6 overflow-hidden rounded-[28px] border border-brand-accent-deep/10 bg-surface-panel px-4 py-4">
          <Text className="font-sans text-sm leading-6 text-ink-dark/70">
            Draft, unavailable, active trade i archive sada imaju svoj cist lane, plus bulk akcije
            i jednostavan reorder unutar live i draft toka.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-3"
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Text className="font-sans text-sm font-semibold text-base-canvas">Nova objava</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
              onPress={() => setSelectionMode((prev) => !prev)}
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark">
                {selectionMode ? 'Zavrsi izbor' : 'Bulk select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-6 flex-row rounded-[24px] bg-surface-panel p-2">
          {(['live', 'drafts', 'archive'] as ClosetBucket[]).map((bucket) => (
            <TouchableOpacity
              key={bucket}
              onPress={() => {
                setActiveBucket(bucket)
                setSelectedIds([])
                setSelectionMode(false)
              }}
              className={`flex-1 rounded-[18px] px-3 py-3 ${bucket === activeBucket ? 'bg-brand-accent-deep' : ''}`}
            >
              <Text
                className={`text-center font-sans text-sm font-semibold ${bucket === activeBucket ? 'text-base-canvas' : 'text-ink-dark/60'}`}
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

        <View className="mb-5">
          <Text className="font-display text-3xl text-ink-dark">{BUCKET_META[activeBucket].title}</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
            {BUCKET_META[activeBucket].description}
          </Text>
        </View>

        {selectionMode && selectedIds.length > 0 ? (
          <View className="mb-5 rounded-[24px] border border-brand-accent-deep/10 bg-surface-panel px-4 py-4">
            <Text className="font-sans text-sm text-ink-dark/70">
              Izabrano: {selectedIds.length} komada
            </Text>
            {hasLockedSelection ? (
              <Text className="mt-2 font-sans text-xs leading-5 text-ink-dark/55">
                Komadi u aktivnom trade toku ne mogu da menjaju status kroz bulk akciju dok se trade ne zatvori.
              </Text>
            ) : null}
            <View className="mt-3 flex-row flex-wrap gap-3">
              {activeBucket === 'live' && !hasLockedSelection ? (
                <>
                  <TouchableOpacity
                    className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
                    onPress={() => runBulk('unavailable')}
                    disabled={submitting}
                  >
                    <Text className="font-sans text-sm font-semibold text-ink-dark">Pause</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
                    onPress={() => runBulk('available')}
                    disabled={submitting}
                  >
                    <Text className="font-sans text-sm font-semibold text-ink-dark">Go live</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
                    onPress={() => runBulk('archive')}
                    disabled={submitting}
                  >
                    <Text className="font-sans text-sm font-semibold text-ink-dark">Archive</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {activeBucket === 'drafts' ? (
                <TouchableOpacity
                  className="rounded-full bg-brand-accent-deep px-4 py-3"
                  onPress={() => runBulk('publish')}
                  disabled={submitting}
                >
                  <Text className="font-sans text-sm font-semibold text-base-canvas">Publish drafts</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
                onPress={() => runBulk('delete')}
                disabled={submitting}
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {visibleItems.length === 0 ? (
          <EditorialEmptyState
            icon={activeBucket === 'drafts' ? 'document-text-outline' : 'shirt-outline'}
            title={
              activeBucket === 'live'
                ? 'Live closet je prazan'
                : activeBucket === 'drafts'
                  ? 'Draft lane je miran'
                  : 'Archive jos nema komade'
            }
            description={
              activeBucket === 'live'
                ? 'Objavi komad ili vrati arhivirani item nazad u aktivni closet.'
                : activeBucket === 'drafts'
                  ? 'Sacuvaj nedovrsenu objavu kao draft i vrati joj se kasnije.'
                  : 'Kada zavrsis trade, prodas komad ili ga arhiviras, ovde ostaje trag.'
            }
            actionLabel={activeBucket === 'archive' ? undefined : 'Dodaj objavu'}
            onAction={activeBucket === 'archive' ? undefined : () => router.push('/(tabs)/upload')}
          />
        ) : (
          visibleItems.map((item, index) => (
            <ClosetCard
              key={item._id}
              item={item}
              selectable={selectionMode}
              selected={selectedIds.includes(item._id)}
              onToggleSelect={() => toggleSelect(item._id)}
              onOpen={() => router.push(`/items/${item._id}`)}
              onMoveUp={
                activeBucket !== 'archive' && index > 0
                  ? () => reorderWithinBucket(item._id, -1)
                  : undefined
              }
              onMoveDown={
                activeBucket !== 'archive' && index < visibleItems.length - 1
                  ? () => reorderWithinBucket(item._id, 1)
                  : undefined
              }
              onQuickAction={
                quickActionLabel(item) && item.status !== 'pending_trade'
                  ? () => handleQuickAction(item)
                  : undefined
              }
              quickActionLabel={quickActionLabel(item)}
            />
          ))
        )}
      </View>
    </ScrollView>
  )
}
