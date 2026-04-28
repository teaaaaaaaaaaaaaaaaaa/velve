import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'

type TradeUser = {
  _id: string
  displayName: string
  photoURL?: string
}

type TradeItem = {
  _id: string
  title: string
  primaryImage?: string
  images?: string[]
}

type TradeRecord = {
  _id: string
  kind: 'trade' | 'buy'
  userRole: 'sender' | 'receiver'
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'
  bucket: 'pending' | 'active' | 'history'
  counterpart: TradeUser
  offeredItemId?: TradeItem | null
  requestedItemId?: TradeItem | null
  offeredPrice?: number | null
  updatedAt: string
  createdAt: string
  completedAt?: string
  canRate?: boolean
}

function getTradeItemImage(item?: TradeItem | null) {
  return item?.primaryImage || item?.images?.[0] || undefined
}

function getStatusLabel(status: TradeRecord['status'], completedAt?: string) {
  if (completedAt) return 'Zavrseno'
  if (status === 'rejected') return 'Odbijeno'
  if (status === 'cancelled') return 'Otkazano'
  if (status === 'expired') return 'Isteklo'
  if (status === 'accepted') return 'Prihvaceno'
  return 'Istorija'
}

export default function TradeArchiveScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [trades, setTrades] = useState<TradeRecord[]>([])

  const loadTrades = useCallback(async () => {
    const response = await client.get('/api/trades/history')
    if (response.data.ok) {
      setTrades(response.data.data || [])
    }
  }, [])

  useEffect(() => {
    loadTrades()
      .catch(() => undefined)
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator color={colors.accentDeep} />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <BrandBackground />

      <View className="px-5 pb-8 pt-14">
        <View className="mb-5 flex-row items-end justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              Trade history
            </Text>
            <Text className="font-display text-4xl text-ink-dark">Arhiva tradeova</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        {trades.length === 0 ? (
          <EditorialEmptyState
            icon="archive-outline"
            title="Arhiva je prazna"
            description="Ovde ce zavrsavati odbijeni, istekli i zavrseni trade tokovi."
          />
        ) : (
          <View className="gap-3">
            {trades.map((trade) => (
              <View key={trade._id} className="rounded-[26px] bg-surface-panel px-4 py-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {trade.counterpart?.photoURL ? (
                      <RemoteImage uri={trade.counterpart.photoURL} className="h-11 w-11 rounded-full" />
                    ) : (
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/40">
                        <Text className="font-display text-xl text-brand-accent-deep">
                          {(trade.counterpart?.displayName || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="ml-3">
                      <Text className="font-sans text-sm font-semibold text-ink-dark">
                        {trade.counterpart?.displayName || 'Korisnik'}
                      </Text>
                      <Text className="font-sans text-xs text-ink-dark/45">
                        {trade.kind === 'buy' ? 'Kupovina' : 'Razmena'}
                      </Text>
                    </View>
                  </View>

                  <View className="rounded-full bg-ink-dark/8 px-3 py-1.5">
                    <Text className="font-sans text-[11px] font-semibold text-ink-dark/70">
                      {getStatusLabel(trade.status, trade.completedAt)}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 flex-row gap-3">
                  {trade.offeredItemId ? (
                    <View className="flex-1">
                      <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/40">
                        Nudio
                      </Text>
                      <View className="mt-2 overflow-hidden rounded-[18px] bg-base-canvas">
                        {getTradeItemImage(trade.offeredItemId) ? (
                          <RemoteImage
                            uri={getTradeItemImage(trade.offeredItemId)}
                            className="aspect-square w-full"
                          />
                        ) : (
                          <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                            <Ionicons name="shirt-outline" size={22} color={colors.accentDeep} />
                          </View>
                        )}
                      </View>
                      <Text className="mt-2 font-sans text-sm font-semibold text-ink-dark" numberOfLines={2}>
                        {trade.offeredItemId.title}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-1">
                    <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/40">
                      Trazeno
                    </Text>
                    <View className="mt-2 overflow-hidden rounded-[18px] bg-base-canvas">
                      {getTradeItemImage(trade.requestedItemId) ? (
                        <RemoteImage
                          uri={getTradeItemImage(trade.requestedItemId)}
                          className="aspect-square w-full"
                        />
                      ) : (
                        <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                          <Ionicons name="shirt-outline" size={22} color={colors.accentDeep} />
                        </View>
                      )}
                    </View>
                    <Text className="mt-2 font-sans text-sm font-semibold text-ink-dark" numberOfLines={2}>
                      {trade.requestedItemId?.title || 'Predmet'}
                    </Text>
                  </View>
                </View>

                {trade.canRate ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: '/rate-trade', params: { tradeId: trade._id } })
                    }
                    className="mt-4 flex-row items-center justify-center rounded-full bg-brand-accent-deep px-4 py-3"
                  >
                    <Ionicons name="star-outline" size={16} color={colors.baseCanvas} />
                    <Text className="ml-2 font-sans text-sm font-semibold text-base-canvas">
                      Oceni razmenu
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
