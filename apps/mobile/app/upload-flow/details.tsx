import { Ionicons } from '@expo/vector-icons'
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

type Condition = 'new' | 'like_new' | 'good' | 'fair'
type ListingType = 'trade' | 'sell' | 'both'

type ItemPayload = {
  _id: string
  title: string
  description: string
  category: string
  brand: string
  size: string
  condition: Condition
  images: string[]
  imageClean?: string | null
  primaryImage?: string | null
  status: string
  listingType?: ListingType
  price?: number
  tradeFor?: string
}

const CATEGORIES = ['Haljine', 'Majice', 'Pantalone', 'Jakne', 'Obuca', 'Dodaci']
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'Novo' },
  { value: 'like_new', label: 'Kao novo' },
  { value: 'good', label: 'Dobro stanje' },
  { value: 'fair', label: 'Prihvatljivo' },
]
const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'trade', label: 'Razmeni' },
  { value: 'sell', label: 'Proda' },
  { value: 'both', label: 'Oboje' },
]

export default function CleanCutDetailsScreen() {
  const router = useRouter()
  const { itemId } = useLocalSearchParams<{ itemId: string }>()

  const [item, setItem] = useState<ItemPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [condition, setCondition] = useState<Condition>('good')
  const [listingType, setListingType] = useState<ListingType>('trade')
  const [price, setPrice] = useState('')
  const [tradeFor, setTradeFor] = useState('')

  useEffect(() => {
    if (!itemId) {
      router.replace('/upload-flow')
      return
    }

    let active = true
    ;(async () => {
      try {
        const response = await client.get(`/api/items/${itemId}`)
        const data = response.data?.data as ItemPayload
        if (!active) return
        setItem(data)
        setTitle(data.title === 'Untitled draft' ? '' : data.title || '')
        setDescription(data.description || '')
        setCategory(data.category === 'Unsorted' ? '' : data.category || '')
        setBrand(data.brand || '')
        setSize(data.size || '')
        setCondition(data.condition || 'good')
        setListingType(data.listingType || 'trade')
        setPrice(data.price != null ? String(data.price) : '')
        setTradeFor(data.tradeFor || '')
      } catch (error) {
        if (active) {
          Alert.alert('Ne mogu da ucitam draft', 'Pokusaj ponovo.', [
            { text: 'Nazad', onPress: () => router.replace('/(tabs)/closet') },
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

  async function saveItem(nextStatus: 'draft' | 'available') {
    if (!itemId) return

    if (!title.trim()) {
      Alert.alert('Greska', 'Naslov je obavezan.')
      return
    }
    if (!category.trim()) {
      Alert.alert('Greska', 'Kategorija je obavezna.')
      return
    }
    if (!description.trim()) {
      Alert.alert('Greska', 'Opis je obavezan.')
      return
    }
    if ((listingType === 'sell' || listingType === 'both') && !price.trim()) {
      Alert.alert('Greska', 'Cena je obavezna za prodaju.')
      return
    }

    try {
      setSaving(true)
      await client.put(`/api/items/${itemId}`, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        brand: brand.trim(),
        size: size.trim(),
        condition,
        listingType,
        price: listingType === 'sell' || listingType === 'both' ? Number(price) : undefined,
        tradeFor: listingType === 'trade' || listingType === 'both' ? tradeFor.trim() || undefined : undefined,
      })

      await client.put(`/api/items/${itemId}/status`, { status: nextStatus })
      router.replace('/(tabs)/closet')
    } catch (error: any) {
      Alert.alert(
        'Greska',
        error?.response?.data?.error || error?.message || 'Ne mogu da sacuvam item.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function generateCopy() {
    if (!category.trim()) {
      Alert.alert('Greska', 'Izaberi kategoriju pre AI opisa.')
      return
    }

    try {
      setGenerating(true)
      const response = await client.post('/api/ai/generate-description', {
        category,
        brand,
        size,
        condition,
      })

      const payload = response.data?.data
      if (payload?.title) setTitle(payload.title)
      if (payload?.description) setDescription(payload.description)
    } catch {
      Alert.alert('AI nije dostupan', 'Opis trenutno ne moze da se generise.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <BrandedLoader />
  }

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-5 pb-8 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-5 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
        </TouchableOpacity>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Listing details
        </Text>
        <Text className="mt-2 font-display text-4xl text-ink-dark">
          Zavrsi arhiviranje
        </Text>

        <View className="mt-6 flex-row gap-3">
          <RemoteImage
            uri={getPrimaryItemImage(item) || undefined}
            className="h-[240px] flex-1 rounded-[28px] bg-surface-panel"
          />
          <RemoteImage
            uri={item?.images?.[0] || undefined}
            className="h-[240px] w-[110px] rounded-[28px] bg-surface-panel"
          />
        </View>

        <TouchableOpacity
          onPress={generateCopy}
          disabled={generating}
          className="mt-5 items-center rounded-full border border-brand-accent-deep/15 bg-surface-panel px-4 py-4"
        >
          {generating ? (
            <ActivityIndicator size="small" color={colors.accentDeep} />
          ) : (
            <Text className="font-sans text-sm font-semibold text-ink-dark">
              Generisi AI opis
            </Text>
          )}
        </TouchableOpacity>

        <View className="mt-5">
          <Text className="mb-2 font-sans text-sm text-ink-dark">Naslov</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Naziv komada"
            placeholderTextColor="#2B2A2B66"
            className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-sans text-sm text-ink-dark">Opis</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Opis komada"
            placeholderTextColor="#2B2A2B66"
            multiline
            textAlignVertical="top"
            className="min-h-[132px] rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm leading-6 text-ink-dark"
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-sans text-sm text-ink-dark">Kategorija</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((entry) => (
              <TouchableOpacity
                key={entry}
                onPress={() => setCategory(entry)}
                className={`rounded-full px-4 py-2.5 ${category === entry ? 'bg-brand-accent-deep' : 'bg-surface-panel'}`}
              >
                <Text className={`font-sans text-sm ${category === entry ? 'text-base-canvas' : 'text-ink-dark'}`}>
                  {entry}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-2 font-sans text-sm text-ink-dark">Brand</Text>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="Npr. Zara"
              placeholderTextColor="#2B2A2B66"
              className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-2 font-sans text-sm text-ink-dark">Velicina</Text>
            <TextInput
              value={size}
              onChangeText={setSize}
              placeholder="S / M / L"
              placeholderTextColor="#2B2A2B66"
              className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
            />
          </View>
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-sans text-sm text-ink-dark">Stanje</Text>
          <View className="flex-row flex-wrap gap-2">
            {CONDITIONS.map((entry) => (
              <TouchableOpacity
                key={entry.value}
                onPress={() => setCondition(entry.value)}
                className={`rounded-full px-4 py-2.5 ${condition === entry.value ? 'bg-brand-accent-deep' : 'bg-surface-panel'}`}
              >
                <Text className={`font-sans text-sm ${condition === entry.value ? 'text-base-canvas' : 'text-ink-dark'}`}>
                  {entry.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-sans text-sm text-ink-dark">Tip oglasa</Text>
          <View className="flex-row gap-2">
            {LISTING_TYPES.map((entry) => (
              <TouchableOpacity
                key={entry.value}
                onPress={() => setListingType(entry.value)}
                className={`flex-1 rounded-full px-4 py-3 ${listingType === entry.value ? 'bg-brand-accent-deep' : 'bg-surface-panel'}`}
              >
                <Text className={`text-center font-sans text-sm font-semibold ${listingType === entry.value ? 'text-base-canvas' : 'text-ink-dark'}`}>
                  {entry.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {(listingType === 'sell' || listingType === 'both') ? (
          <View className="mt-4">
            <Text className="mb-2 font-sans text-sm text-ink-dark">Cena</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="Cena u EUR"
              placeholderTextColor="#2B2A2B66"
              keyboardType="numeric"
              className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
            />
          </View>
        ) : null}

        {(listingType === 'trade' || listingType === 'both') ? (
          <View className="mt-4">
            <Text className="mb-2 font-sans text-sm text-ink-dark">Sta trazis za razmenu</Text>
            <TextInput
              value={tradeFor}
              onChangeText={setTradeFor}
              placeholder="Npr. oversized jakna"
              placeholderTextColor="#2B2A2B66"
              className="rounded-[24px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
            />
          </View>
        ) : null}

        <TouchableOpacity
          disabled={saving}
          onPress={() => saveItem('available')}
          className="mt-8 items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.baseCanvas} />
          ) : (
            <Text className="font-sans text-base font-semibold text-base-canvas">
              Objavi u arhiv
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={saving}
          onPress={() => saveItem('draft')}
          className="mt-3 items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
        >
          <Text className="font-sans text-base font-semibold text-ink-dark">
            Sacuvaj draft
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
