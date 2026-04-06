import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'

type TradeBucket = 'pending' | 'active' | 'history'
type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'
type TradeKind = 'trade' | 'buy'

type TradeCounterpart = {
  _id: string
  displayName: string
  photoURL?: string
  averageRating?: number
  completedTrades?: number
}

type TradeItem = {
  _id: string
  title: string
  images?: string[]
  status?: string
  listingType?: 'sell' | 'trade' | 'both'
}

type TradeRecord = {
  _id: string
  kind: TradeKind
  status: TradeStatus
  bucket: TradeBucket
  userRole: 'sender' | 'receiver'
  counterpart?: TradeCounterpart
  offeredItemId?: TradeItem | null
  requestedItemId?: TradeItem | null
  message?: string
  expiresAt?: string
  updatedAt: string
  completedAt?: string
  canAccept: boolean
  canReject: boolean
  canCancel: boolean
  canComplete: boolean
  canRate: boolean
}

const BUCKET_COPY: Record<TradeBucket, { title: string; description: string }> = {
  pending: {
    title: 'Pending requests',
    description: 'Ovde su novi zahtevi i oni koji cekaju odgovor ili povratnu odluku.',
  },
  active: {
    title: 'Active lifecycle',
    description: 'Prihvaceni trade tokovi koji su u zivoj razmeni i cekaju zatvaranje.',
  },
  history: {
    title: 'Trade history',
    description: 'Zavrseni, odbijeni, otkazani i istekli tokovi sa rating zavrsetkom.',
  },
}

function formatRelativeDate(date?: string) {
  if (!date) return 'Bez datuma'
  return new Date(date).toLocaleDateString('sr-Latn', {
    day: 'numeric',
    month: 'short',
  })
}

function buildTradeStatusTone(status: TradeStatus) {
  switch (status) {
    case 'accepted':
      return 'bg-brand-highlight text-ink-dark'
    case 'rejected':
    case 'cancelled':
      return 'bg-white text-brand-accent-deep'
    case 'expired':
      return 'bg-brand-accent-light/20 text-brand-accent-deep'
    default:
      return 'bg-brand-accent-light/30 text-brand-accent-deep'
  }
}

function buildTradeStatusLabel(trade: TradeRecord) {
  if (trade.bucket === 'history' && trade.completedAt) return 'Completed'
  if (trade.status === 'accepted') return 'Active'
  if (trade.status === 'cancelled') return 'Cancelled'
  if (trade.status === 'expired') return 'Expired'
  if (trade.status === 'rejected') return 'Declined'
  return trade.userRole === 'receiver' ? 'Needs response' : 'Waiting'
}

function StarButton({
  filled,
  onPress,
}: {
  filled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity onPress={onPress} className="mr-2">
      <Ionicons name={filled ? 'star' : 'star-outline'} size={28} color={filled ? '#CBDA63' : '#431A43'} />
    </TouchableOpacity>
  )
}

function ItemPreview({
  title,
  imageUri,
  eyebrow,
}: {
  title: string
  imageUri?: string
  eyebrow: string
}) {
  return (
    <View className="flex-1">
      <View className="overflow-hidden rounded-[20px] bg-base-canvas">
        {imageUri ? (
          <RemoteImage
            uri={imageUri}
            className="aspect-[0.82] w-full"
            fallback={
              <View className="aspect-[0.82] w-full items-center justify-center bg-brand-accent-light/20">
                <Ionicons name="shirt-outline" size={26} color="#431A43" />
              </View>
            }
          />
        ) : (
          <View className="aspect-[0.82] w-full items-center justify-center bg-brand-accent-light/20">
            <Ionicons name="shirt-outline" size={26} color="#431A43" />
          </View>
        )}
      </View>
      <Text className="mt-2 font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
        {eyebrow}
      </Text>
      <Text className="font-sans text-sm font-semibold leading-5 text-ink-dark" numberOfLines={2}>
        {title}
      </Text>
    </View>
  )
}

function TradeCard({
  trade,
  onOpenChat,
  onAccept,
  onReject,
  onCancel,
  onComplete,
  onRate,
}: {
  trade: TradeRecord
  onOpenChat: () => void
  onAccept: () => void
  onReject: () => void
  onCancel: () => void
  onComplete: () => void
  onRate: () => void
}) {
  const tone = buildTradeStatusTone(trade.status)
  const counterpartName = trade.counterpart?.displayName || 'Korisnik'
  const requestedItem = trade.requestedItemId
  const offeredItem = trade.offeredItemId

  return (
    <View className="mb-4 overflow-hidden rounded-[28px] border border-ink-dark/8 bg-white px-4 py-4">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-row items-center pr-4">
          {trade.counterpart?.photoURL ? (
            <RemoteImage
              uri={trade.counterpart.photoURL}
              className="h-12 w-12 rounded-full"
              fallback={
                <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/35">
                  <Text className="font-display text-xl text-brand-accent-deep">
                    {counterpartName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
            />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light/35">
              <Text className="font-display text-xl text-brand-accent-deep">
                {counterpartName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View className="ml-3">
            <Text className="font-display text-2xl text-ink-dark">{counterpartName}</Text>
            <Text className="font-sans text-xs text-ink-dark/55">
              {trade.counterpart?.averageRating
                ? `${trade.counterpart.averageRating.toFixed(1)} rating`
                : 'Novi profil'}{' '}
              / {trade.counterpart?.completedTrades || 0} swaps
            </Text>
          </View>
        </View>

        <View className={`rounded-full px-3 py-2 ${tone.split(' ')[0]}`}>
          <Text className={`font-sans text-xs font-semibold ${tone.split(' ')[1]}`}>
            {buildTradeStatusLabel(trade)}
          </Text>
        </View>
      </View>

      <View className="mb-4 rounded-[22px] bg-base-canvas px-4 py-3">
        <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
          Lifecycle note
        </Text>
        <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/70">
          {trade.bucket === 'pending'
            ? trade.userRole === 'receiver'
              ? 'Ovaj zahtev ceka tvoju odluku i jasno vodi ka accept ili decline toku.'
              : 'Zahtev je poslat i ceka odgovor druge strane.'
            : trade.bucket === 'active'
              ? 'Trade je prihvacen i oba komada su zakljucana dok ga neko ne oznaci kao zavrsen.'
              : trade.completedAt
                ? 'Trade je zatvoren i ovde ostaje rating zavrsetak za poverenje.'
                : 'Tok je zatvoren i ostaje u istoriji kao referenca za buduce odluke.'}
        </Text>
      </View>

      {trade.kind === 'trade' && requestedItem && offeredItem ? (
        <View className="mb-4 flex-row items-center gap-3">
          <ItemPreview
            title={offeredItem.title}
            imageUri={offeredItem.images?.[0]}
            eyebrow={trade.userRole === 'sender' ? 'Tvoj komad' : 'Njihov komad'}
          />
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-deep/8">
            <Ionicons name="swap-horizontal" size={18} color="#431A43" />
          </View>
          <ItemPreview
            title={requestedItem.title}
            imageUri={requestedItem.images?.[0]}
            eyebrow={trade.userRole === 'sender' ? 'Njihov komad' : 'Tvoj komad'}
          />
        </View>
      ) : requestedItem ? (
        <View className="mb-4">
          <ItemPreview
            title={requestedItem.title}
            imageUri={requestedItem.images?.[0]}
            eyebrow="Buy request"
          />
        </View>
      ) : null}

      {trade.message ? (
        <View className="mb-4 rounded-[22px] border border-ink-dark/8 bg-white px-4 py-3">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
            Poruka
          </Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/75">{trade.message}</Text>
        </View>
      ) : null}

      <View className="mb-4 flex-row flex-wrap gap-2">
        <View className="rounded-full bg-base-canvas px-3 py-2">
          <Text className="font-sans text-xs text-ink-dark/70">
            {trade.kind === 'buy' ? 'Kupovina' : 'Razmena'}
          </Text>
        </View>
        <View className="rounded-full bg-base-canvas px-3 py-2">
          <Text className="font-sans text-xs text-ink-dark/70">
            {trade.userRole === 'receiver' ? 'Primljen zahtev' : 'Poslat zahtev'}
          </Text>
        </View>
        {trade.expiresAt && trade.bucket === 'pending' ? (
          <View className="rounded-full bg-base-canvas px-3 py-2">
            <Text className="font-sans text-xs text-ink-dark/70">
              Istice {formatRelativeDate(trade.expiresAt)}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-3">
        <TouchableOpacity
          onPress={onOpenChat}
          className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
        >
          <Text className="font-sans text-sm font-semibold text-ink-dark">Otvori chat</Text>
        </TouchableOpacity>

        {trade.canAccept ? (
          <TouchableOpacity
            onPress={onAccept}
            className="rounded-full bg-brand-highlight px-4 py-3"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark">Accept</Text>
          </TouchableOpacity>
        ) : null}

        {trade.canReject ? (
          <TouchableOpacity
            onPress={onReject}
            className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark">Decline</Text>
          </TouchableOpacity>
        ) : null}

        {trade.canCancel ? (
          <TouchableOpacity
            onPress={onCancel}
            className="rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark">Cancel</Text>
          </TouchableOpacity>
        ) : null}

        {trade.canComplete ? (
          <TouchableOpacity
            onPress={onComplete}
            className="rounded-full bg-brand-accent-deep px-4 py-3"
          >
            <Text className="font-sans text-sm font-semibold text-base-canvas">Complete</Text>
          </TouchableOpacity>
        ) : null}

        {trade.canRate ? (
          <TouchableOpacity
            onPress={onRate}
            className="rounded-full bg-brand-accent-deep px-4 py-3"
          >
            <Text className="font-sans text-sm font-semibold text-base-canvas">Rate</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

export default function TradesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ bucket?: string }>()

  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [activeBucket, setActiveBucket] = useState<TradeBucket>('pending')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [ratingTarget, setRatingTarget] = useState<TradeRecord | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingNote, setRatingNote] = useState('')

  useEffect(() => {
    if (params.bucket === 'pending' || params.bucket === 'active' || params.bucket === 'history') {
      setActiveBucket(params.bucket)
    }
  }, [params.bucket])

  const bucketCounts = useMemo(
    () => ({
      pending: trades.filter((trade) => trade.bucket === 'pending').length,
      active: trades.filter((trade) => trade.bucket === 'active').length,
      history: trades.filter((trade) => trade.bucket === 'history').length,
    }),
    [trades]
  )

  const filteredTrades = useMemo(
    () => trades.filter((trade) => trade.bucket === activeBucket),
    [activeBucket, trades]
  )

  const loadTrades = useCallback(async () => {
    const response = await client.get('/api/trades')
    if (response.data.ok) {
      setTrades(response.data.data as TradeRecord[])
    }
  }, [])

  useEffect(() => {
    loadTrades()
      .catch(() => {
        Alert.alert('Greska', 'Trade tokove trenutno nije moguce ucitati.')
      })
      .finally(() => setLoading(false))
  }, [loadTrades])

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await loadTrades()
    } finally {
      setRefreshing(false)
    }
  }, [loadTrades])

  const withSubmit = useCallback(
    async (tradeId: string, action: () => Promise<void>) => {
      try {
        setSubmittingId(tradeId)
        await action()
        await loadTrades()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Akcija nije uspela.'
        Alert.alert('Greska', message)
      } finally {
        setSubmittingId(null)
      }
    },
    [loadTrades]
  )

  const openChat = useCallback(
    async (trade: TradeRecord) => {
      const counterpartId = trade.counterpart?._id
      if (!counterpartId) return

      try {
        const response = await client.post(`/api/chat/direct/${counterpartId}`)
        if (response.data.ok) {
          router.push(`/(tabs)/chat/${response.data.data.chatId as string}`)
        }
      } catch {
        Alert.alert('Greska', 'Chat trenutno nije moguce otvoriti.')
      }
    },
    [router]
  )

  const submitRating = useCallback(async () => {
    if (!ratingTarget) return

    await withSubmit(ratingTarget._id, async () => {
      await client.post(`/api/trades/${ratingTarget._id}/rate`, {
        rating: ratingValue,
        review: ratingNote.trim() || undefined,
      })
    })

    setRatingTarget(null)
    setRatingValue(5)
    setRatingNote('')
  }, [ratingNote, ratingTarget, ratingValue, withSubmit])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-base-canvas"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-5 pb-8 pt-14">
          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
                Trade lifecycle
              </Text>
              <Text className="font-display text-4xl text-ink-dark">Trade desk</Text>
            </View>
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={22} color="#2B2A2B" />
            </TouchableOpacity>
          </View>

          <View className="mb-6 rounded-[28px] border border-brand-accent-deep/10 bg-white p-4">
            <Text className="font-sans text-sm leading-6 text-ink-dark/70">
              Pending, active i history sada zive odvojeno kako bi korisnik jasno video gde treba
              da reaguje, sta je u toku i sta je zatvoreno.
            </Text>
          </View>

          <View className="mb-6 flex-row rounded-[24px] bg-white p-2">
            {(['pending', 'active', 'history'] as TradeBucket[]).map((bucket) => {
              const isActive = bucket === activeBucket

              return (
                <TouchableOpacity
                  key={bucket}
                  onPress={() => setActiveBucket(bucket)}
                  className={`flex-1 rounded-[18px] px-3 py-3 ${isActive ? 'bg-brand-accent-deep' : ''}`}
                >
                  <Text
                    className={`text-center font-sans text-sm font-semibold ${isActive ? 'text-base-canvas' : 'text-ink-dark/60'}`}
                  >
                    {bucket === 'pending' ? `Pending (${bucketCounts.pending})` : bucket === 'active' ? `Active (${bucketCounts.active})` : `History (${bucketCounts.history})`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View className="mb-5">
            <Text className="font-display text-3xl text-ink-dark">
              {BUCKET_COPY[activeBucket].title}
            </Text>
            <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
              {BUCKET_COPY[activeBucket].description}
            </Text>
          </View>

          {filteredTrades.length === 0 ? (
            <EditorialEmptyState
              icon={activeBucket === 'history' ? 'time-outline' : 'swap-horizontal-outline'}
              title={
                activeBucket === 'pending'
                  ? 'Nema zahteva na cekanju'
                  : activeBucket === 'active'
                    ? 'Nema aktivnih trade tokova'
                    : 'Istorija je jos prazna'
              }
              description={
                activeBucket === 'pending'
                  ? 'Kada stigne novi request ili posaljes predlog, ovde ces ga pratiti sa jasnim sledecim korakom.'
                  : activeBucket === 'active'
                    ? 'Prihvaceni trade-ovi ce se pojaviti ovde dok ne budu kompletirani ili otkazani.'
                    : 'Zavrseni i odbijeni trade tokovi ostaju ovde kao tvoja arhiva poverenja.'
              }
            />
          ) : (
            filteredTrades.map((trade) => (
              <View
                key={trade._id}
                style={submittingId === trade._id ? { opacity: 0.7 } : undefined}
              >
                <TradeCard
                  trade={trade}
                  onOpenChat={() => openChat(trade)}
                  onAccept={() =>
                    withSubmit(trade._id, async () => {
                      await client.put(`/api/trades/${trade._id}`, { status: 'accepted' })
                    })
                  }
                  onReject={() =>
                    withSubmit(trade._id, async () => {
                      await client.put(`/api/trades/${trade._id}`, { status: 'rejected' })
                    })
                  }
                  onCancel={() =>
                    withSubmit(trade._id, async () => {
                      await client.post(`/api/trades/${trade._id}/cancel`, {})
                    })
                  }
                  onComplete={() =>
                    withSubmit(trade._id, async () => {
                      await client.put(`/api/trades/${trade._id}/complete`, {})
                    })
                  }
                  onRate={() => {
                    setRatingTarget(trade)
                    setRatingValue(5)
                    setRatingNote('')
                  }}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(ratingTarget)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRatingTarget(null)}
      >
        <View className="flex-1 bg-base-canvas">
          <View className="flex-row items-center justify-between border-b border-ink-dark/10 px-6 pb-4 pt-12">
            <TouchableOpacity onPress={() => setRatingTarget(null)}>
              <Text className="font-sans text-base text-ink-dark">Zatvori</Text>
            </TouchableOpacity>
            <Text className="font-display text-2xl text-ink-dark">Oceni trade</Text>
            <TouchableOpacity onPress={submitRating}>
              <Text className="font-sans text-base font-semibold text-brand-accent-deep">
                Posalji
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <Text className="font-sans text-sm leading-6 text-ink-dark/70">
              Zakljuci trust flow jasnom ocenom nakon zavrsenog trade-a.
            </Text>

            <View className="mt-6 flex-row items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarButton
                  key={star}
                  filled={star <= ratingValue}
                  onPress={() => setRatingValue(star)}
                />
              ))}
            </View>

            <View className="mt-6">
              <Text className="mb-2 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
                Kratak review
              </Text>
              <TextInput
                value={ratingNote}
                onChangeText={setRatingNote}
                maxLength={300}
                multiline
                textAlignVertical="top"
                placeholder="Kako je prosao trade, komunikacija i isporuka komada?"
                placeholderTextColor="#2B2A2B66"
                className="min-h-[160px] rounded-[24px] border border-ink-dark/10 bg-white px-4 py-4 font-sans text-sm leading-6 text-ink-dark"
              />
              <Text className="mt-2 font-sans text-xs text-ink-dark/40">{ratingNote.length}/300</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
