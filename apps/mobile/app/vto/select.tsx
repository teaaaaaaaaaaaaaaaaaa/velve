import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getPrimaryItemImage, hasDigitizedImage } from '@/lib/itemImages'
import { resolveVtoGarmentCategory } from '@/lib/vtoCategory'

type ClosetItem = {
  _id: string
  title: string
  brand?: string
  category?: string
  images?: string[]
  imageClean?: string | null
  primaryImage?: string | null
  isDigitized?: boolean
}

const MAX_SELECTED_ITEMS = 4

export default function VtoSelectScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ClosetItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | 'tops' | 'bottoms' | 'one-pieces'>('all')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

  useEffect(() => {
    client
      .get('/api/items/closet')
      .then((response) => {
        const payload = response.data?.data || {}
        const merged = [...(payload.live || []), ...(payload.drafts || [])]
        setItems(merged.filter((item: ClosetItem) => hasDigitizedImage(item)))
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchable = `${item.title} ${item.brand || ''} ${item.category || ''}`.toLowerCase()
      const matchesQuery = searchable.includes(query.trim().toLowerCase())
      const normalizedCategory = resolveVtoGarmentCategory(item.category)
      const matchesCategory = category === 'all' || normalizedCategory === category

      return matchesQuery && matchesCategory
    })
  }, [category, items, query])

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((entry) => entry !== itemId)
      }

      if (prev.length >= MAX_SELECTED_ITEMS) {
        Alert.alert('Limit dostignut', 'Mozes da izaberes najvise 4 komada za outfit render.')
        return prev
      }

      return [...prev, itemId]
    })
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: ClosetItem }) => {
      const selectedIndex = selectedItemIds.indexOf(item._id)
      const isSelected = selectedIndex >= 0

      return (
        <TouchableOpacity
          style={{ width: '48%', marginBottom: 16 }}
          onPress={() => toggleSelection(item._id)}
          className={`overflow-hidden rounded-[26px] ${
            isSelected ? 'bg-brand-accent-deep/10' : 'bg-surface-panel'
          }`}
        >
          <RemoteImage
            uri={getPrimaryItemImage(item) || undefined}
            className="aspect-[0.82] w-full"
          />
          <View className="px-3 pb-4 pt-3">
            <View className="flex-row items-start justify-between">
              <Text className="flex-1 font-display text-lg text-ink-dark" numberOfLines={2}>
                {item.title}
              </Text>
              <View
                className={`h-7 w-7 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-brand-accent-deep bg-brand-accent-deep'
                    : 'border-ink-dark/25 bg-transparent'
                }`}
              >
                {isSelected ? (
                  <Text className="font-sans text-xs font-semibold text-base-canvas">
                    {selectedIndex + 1}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text className="mt-1 font-sans text-xs text-ink-dark/55">
              {item.brand || 'Digital item'}
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [selectedItemIds, toggleSelection]
  )

  const listHeader = useMemo(
    () => (
      <View className="pb-5 pt-3">
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              Selektor artikala
            </Text>
            <Text className="font-display text-4xl text-ink-dark">Odaberi fit</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="close" size={20} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Pretraga"
          placeholderTextColor="#2B2A2B66"
          className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
        />

        <View className="mt-4 flex-row flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'tops', label: 'Tops' },
            { key: 'bottoms', label: 'Bottoms' },
            { key: 'one-pieces', label: 'One-Pieces' },
          ].map((entry) => (
            <TouchableOpacity
              key={entry.key}
              onPress={() => setCategory(entry.key as 'all' | 'tops' | 'bottoms' | 'one-pieces')}
              className={`rounded-full px-4 py-2.5 ${
                category === entry.key ? 'bg-brand-accent-deep' : 'bg-surface-panel'
              }`}
            >
              <Text
                className={`font-sans text-sm ${
                  category === entry.key ? 'text-base-canvas' : 'text-ink-dark'
                }`}
              >
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="mt-4 font-sans text-sm text-ink-dark/55">
          Izabrano: {selectedItemIds.length}/{MAX_SELECTED_ITEMS}
        </Text>
      </View>
    ),
    [category, query, router, selectedItemIds.length]
  )

  if (loading) {
    return <BrandedLoader />
  }

  const primaryLabel =
    selectedItemIds.length > 1 ? 'Try On Outfit' : selectedItemIds.length === 1 ? 'Try On' : 'Izaberi komad'

  return (
    <SafeAreaView className="flex-1 bg-base-canvas" edges={['top', 'bottom']}>
      <View className="flex-1">
        <FlatList
          className="flex-1"
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View className="rounded-[28px] bg-surface-panel px-4 py-6">
              <Text className="font-display text-2xl text-ink-dark">Nema spremnih komada</Text>
              <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/65">
                Prvo digitalizuj bar jedan artikal kroz Clean Cut, pa se vrati ovde.
              </Text>
            </View>
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 116,
            flexGrow: filteredItems.length === 0 ? 1 : undefined,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View
          className="bg-base-canvas px-5 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 4,
            shadowColor: '#2B2A2B',
            shadowOpacity: 0.07,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: -4 },
            elevation: 6,
          }}
        >
          <TouchableOpacity
            disabled={selectedItemIds.length === 0}
            onPress={() =>
              router.push({
                pathname: '/vto/render',
                params:
                  selectedItemIds.length === 1
                    ? { itemId: selectedItemIds[0] }
                    : { itemIds: JSON.stringify(selectedItemIds) },
              })
            }
            className={`items-center rounded-full px-4 py-4 ${
              selectedItemIds.length > 0 ? 'bg-brand-accent-deep' : 'bg-brand-accent-deep/20'
            }`}
          >
            <Text
              className={`font-sans text-base font-semibold ${
                selectedItemIds.length > 0 ? 'text-base-canvas' : 'text-ink-dark/45'
              }`}
            >
              {primaryLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
