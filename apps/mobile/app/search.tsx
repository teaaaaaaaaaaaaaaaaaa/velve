import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import client from '@/api/client'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard'

type SearchItem = DiscoveryCardItem

const CONDITION_OPTIONS = [
  { label: 'Sve', value: '' },
  { label: 'Novo', value: 'new' },
  { label: 'Kao novo', value: 'like_new' },
  { label: 'Dobro', value: 'good' },
  { label: 'OK', value: 'fair' },
]

const LISTING_OPTIONS = [
  { label: 'Sve', value: '' },
  { label: 'Razmena', value: 'trade' },
  { label: 'Kupovina', value: 'sell' },
  { label: 'Oba', value: 'both' },
]

export default function SearchScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [city, setCity] = useState('')
  const [condition, setCondition] = useState('')
  const [listingType, setListingType] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isCompactLayout = width < 390
  const numColumns = width < 360 ? 1 : 2
  const hasActiveFilters = Boolean(
    query.trim() || brand.trim() || size.trim() || city.trim() || condition || listingType
  )

  const params = useMemo(
    () => ({
      limit: 30,
      search: query.trim() || undefined,
      brand: brand.trim() || undefined,
      size: size.trim() || undefined,
      city: city.trim() || undefined,
      condition: condition || undefined,
      listingType: listingType || undefined,
    }),
    [brand, city, condition, listingType, query, size]
  )

  const clearFilters = () => {
    setQuery('')
    setBrand('')
    setSize('')
    setCity('')
    setCondition('')
    setListingType('')
  }

  const loadResults = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true)
      }

      const response = await client.get('/api/items', { params })
      if (response.data.ok) {
        setItems(response.data.data)
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadResults(items.length === 0)
    }, 250)

    return () => clearTimeout(timeout)
  }, [params])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadResults(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-base-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        key={`search-grid-${numColumns}`}
        data={items}
        numColumns={numColumns}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        columnWrapperStyle={
          numColumns === 2
            ? {
                gap: 12,
                paddingHorizontal: 20,
              }
            : undefined
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View className="px-5 pb-6 pt-2">
            <View className="mb-5 flex-row items-start">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-white"
              >
                <Ionicons name="arrow-back" size={22} color="#2B2A2B" />
              </TouchableOpacity>

              <View className="ml-4 flex-1">
                <Text className="font-display text-4xl text-ink-dark">Search</Text>
                <Text className="mt-1 font-sans text-sm leading-5 text-ink-dark/60">
                  Filtriraj discovery po ukusu, velicini i gradu bez raspadanja layouta na manjem ekranu.
                </Text>
              </View>
            </View>

            <View className="overflow-hidden rounded-[32px] border border-brand-accent-deep/10 bg-white px-4 py-4">
              <View className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-accent-light/30" />
              <View className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-brand-highlight/20" />

              <View className="mb-4 flex-row items-center rounded-full bg-base-canvas px-4 py-3">
                <Ionicons name="search" size={18} color="#431A43" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Pretrazi title, brand ili kategoriju..."
                  placeholderTextColor="#2B2A2B66"
                  className="ml-3 flex-1 font-sans text-sm text-ink-dark"
                />
              </View>

              <View className={isCompactLayout ? 'gap-3' : 'flex-row gap-3'}>
                <View className="flex-1 rounded-[20px] bg-base-canvas px-4 py-3">
                  <Text className="mb-1 font-sans text-[11px] uppercase tracking-[0.8px] text-ink-dark/45">
                    Brand
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="npr. Zara"
                    placeholderTextColor="#2B2A2B66"
                    className="font-sans text-sm text-ink-dark"
                  />
                </View>

                <View className="flex-1 rounded-[20px] bg-base-canvas px-4 py-3">
                  <Text className="mb-1 font-sans text-[11px] uppercase tracking-[0.8px] text-ink-dark/45">
                    Velicina
                  </Text>
                  <TextInput
                    value={size}
                    onChangeText={setSize}
                    placeholder="S / 38 / M"
                    placeholderTextColor="#2B2A2B66"
                    className="font-sans text-sm text-ink-dark"
                  />
                </View>
              </View>

              <View className="mt-3 rounded-[20px] bg-base-canvas px-4 py-3">
                <Text className="mb-1 font-sans text-[11px] uppercase tracking-[0.8px] text-ink-dark/45">
                  Grad
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Beograd, Novi Sad..."
                  placeholderTextColor="#2B2A2B66"
                  className="font-sans text-sm text-ink-dark"
                />
              </View>

              <View className="mt-4 rounded-[24px] bg-base-canvas/90 px-4 py-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-[11px] uppercase tracking-[1px] text-ink-dark/45">
                    Stanje
                  </Text>
                  {hasActiveFilters ? (
                    <TouchableOpacity onPress={clearFilters} className="rounded-full bg-white px-3 py-1.5">
                      <Text className="font-sans text-xs font-semibold text-brand-accent-deep">
                        Ocisti sve
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {CONDITION_OPTIONS.map((option) => {
                    const isActive = condition === option.value

                    return (
                      <TouchableOpacity
                        key={option.value || 'all-condition'}
                        onPress={() => setCondition(option.value)}
                        className={`rounded-full px-4 py-2.5 ${isActive ? 'bg-brand-accent-deep' : 'bg-white'}`}
                      >
                        <Text className={`font-sans text-sm ${isActive ? 'text-base-canvas' : 'text-ink-dark'}`}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              <View className="mt-3 rounded-[24px] bg-base-canvas/90 px-4 py-4">
                <Text className="font-sans text-[11px] uppercase tracking-[1px] text-ink-dark/45">
                  Tip objave
                </Text>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {LISTING_OPTIONS.map((option) => {
                    const isActive = listingType === option.value

                    return (
                      <TouchableOpacity
                        key={option.value || 'all-listing'}
                        onPress={() => setListingType(option.value)}
                        className={`rounded-full border px-4 py-2.5 ${isActive ? 'border-brand-highlight bg-brand-highlight' : 'border-ink-dark/10 bg-white'}`}
                      >
                        <Text className="font-sans text-sm text-ink-dark">{option.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </View>

            {!loading ? (
              <View className="mt-5 flex-row items-center justify-between px-1">
                <Text className="font-display text-2xl text-ink-dark">Curated results</Text>
                <Text className="font-sans text-sm text-ink-dark/55">{items.length} komada</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View className="items-center px-5 py-16" style={{ width: '100%' }}>
              <ActivityIndicator size="large" color="#431A43" />
            </View>
          ) : (
            <View className="px-5 pt-2" style={{ width: '100%' }}>
              <EditorialEmptyState
                icon="sparkles-outline"
                title="Nema rezultata za ovaj filter set"
                description="Pomeri jedan signal, vrati search na sire kriterijume ili ocisti filtere i discovery ce odmah prodisati."
                actionLabel="Ocisti filtere"
                onAction={clearFilters}
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={numColumns === 1 ? { paddingHorizontal: 20 } : { flex: 1 }}>
            <DiscoveryItemCard item={item} onPress={() => router.push(`/items/${item._id}`)} />
          </View>
        )}
      />
    </SafeAreaView>
  )
}
