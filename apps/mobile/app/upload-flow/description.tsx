import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen'
import { VelveTextInput } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { getPrimaryItemImage } from '@/lib/itemImages'

type ItemPayload = {
  _id: string
  images: string[]
  imageClean?: string | null
  primaryImage?: string | null
}

const AI_STEPS = [
  'Analiziramo sliku...',
  'Prepoznajemo boju i stil...',
  'Prepoznajemo detalje komada...',
  'Pisemo opis na srpskom...',
]
const AI_TIMEOUT_SECONDS = 120

function AiLoadingOverlay({ onCancel }: { onCancel: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(AI_TIMEOUT_SECONDS)
  const fade = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(1)).current
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStepIndex((prev) => (prev + 1) % AI_STEPS.length)
        Animated.timing(fade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start()
      })
    }, 2500)
    return () => clearInterval(timer)
  }, [fade])

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: AI_TIMEOUT_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start()

    const countdown = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(countdown)
  }, [progress])

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-base-canvas/95">
      <TouchableOpacity
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Otkazi AI generisanje"
        className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
      >
        <Ionicons name="close" size={22} color={colors.inkDark} />
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-accent-deep/10">
          <Ionicons name="sparkles" size={32} color={colors.accentDeep} />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fade, marginTop: 24 }}>
        <Text className="text-center font-sans text-base tracking-wide text-ink-dark/60">
          {AI_STEPS[stepIndex]}
        </Text>
      </Animated.View>

      <View className="mt-6 w-[72%]">
        <View className="h-2 overflow-hidden rounded-full bg-ink-dark/10">
          <Animated.View
            className="h-full rounded-full bg-brand-accent-deep"
            style={{
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['6%', '100%'],
              }),
            }}
          />
        </View>
        <Text className="mt-3 text-center font-sans text-xs text-ink-dark/45">
          Automatski timeout za {secondsLeft}s
        </Text>
      </View>

      <BrandWordmark width={100} style={{ marginTop: 32, opacity: 0.25 }} />

      <TouchableOpacity onPress={onCancel} className="mt-8 px-8 py-3">
        <Text className="font-sans text-sm text-ink-dark/45">Otkaži</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function DescriptionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    itemId: string
    category: string
    condition: string
    listingType: string
    price: string
    tradeFor: string
    brand: string
    size: string
  }>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const titleInputRef = useRef<TextInput>(null)

  // Fetch item to get image URL for AI
  useEffect(() => {
    if (!params.itemId) return
    client
      .get(`/api/items/${params.itemId}`)
      .then((res) => {
        const item = res.data?.data as ItemPayload
        const url = getPrimaryItemImage(item) || item?.images?.[0] || ''
        setImageUrl(url)
      })
      .catch(() => {})
  }, [params.itemId])

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setGenerating(false)
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }, [])

  const generateAiDescription = useCallback(async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setGenerating(true)
    try {
      const response = await client.post(
        '/api/ai/generate-description',
        {
          category: params.category,
          brand: params.brand,
          size: params.size,
          condition: params.condition,
          image_url: imageUrl,
          language: 'sr',
        },
        { timeout: AI_TIMEOUT_SECONDS * 1000, signal: controller.signal }
      )

      const payload = response.data?.data
      if (payload?.description) setDescription(payload.description)
      setGenerated(true)
    } catch (error: any) {
      if (controller.signal.aborted) return
      Alert.alert('AI nije dostupan', 'Opis trenutno ne moze da se generise. Popuni rucno.')
    } finally {
      setGenerating(false)
    }
  }, [params.category, params.brand, params.size, params.condition, imageUrl])

  const publish = useCallback(
    async (status: 'available' | 'draft') => {
      if (!title.trim()) {
        Alert.alert('Greska', 'Naslov je obavezan.')
        return
      }
      if (!description.trim()) {
        Alert.alert('Greska', 'Opis je obavezan.')
        return
      }

      setSaving(true)
      try {
        await client.put(`/api/items/${params.itemId}`, {
          title: title.trim(),
          description: description.trim(),
          category: params.category,
          brand: params.brand?.trim() || undefined,
          size: params.size?.trim() || undefined,
          condition: params.condition,
          listingType: params.listingType,
          price:
            params.listingType === 'sell' || params.listingType === 'both'
              ? Number(params.price) || undefined
              : undefined,
          tradeFor:
            params.listingType === 'trade' || params.listingType === 'both'
              ? params.tradeFor?.trim() || undefined
              : undefined,
        })

        await client.put(`/api/items/${params.itemId}/status`, { status })
        router.replace('/(tabs)/closet')
      } catch (error: any) {
        Alert.alert(
          'Greska',
          error?.response?.data?.error || error?.message || 'Ne mogu da sacuvam.'
        )
      } finally {
        setSaving(false)
      }
    },
    [title, description, params, router]
  )

  return (
    <KeyboardAwareScreen className="bg-base-canvas">
      <BrandBackground />

      {generating ? <AiLoadingOverlay onCancel={handleCancelGeneration} /> : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
          <View className="flex-1" />
          <Text className="font-sans text-xs text-ink-dark/40">4 / 4</Text>
        </View>

        {/* Progress bar */}
        <View className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-ink-dark/8">
          <View className="h-full w-4/4 rounded-full bg-brand-accent-deep" />
        </View>

        <View className="px-5 pt-8">
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            Poslednji korak
          </Text>
          <Text className="mt-1 font-display text-4xl text-ink-dark">
            Opisi svoj komad
          </Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/55">
            Naslov smislis ti, a AI moze da predlozi samo opis koji zatim slobodno doradis.
          </Text>

          {/* AI Generate Button */}
          {!generated ? (
            <TouchableOpacity
              onPress={generateAiDescription}
              disabled={generating}
              className="mt-6 overflow-hidden rounded-[24px] border border-brand-accent-deep/15 bg-surface-panel"
              style={{
                shadowColor: colors.accentDeep,
                shadowOpacity: 0.1,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <View className="flex-row items-center px-5 py-5">
                <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent-light/25">
                  <Ionicons name="sparkles" size={22} color={colors.accentDeep} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans text-base font-semibold text-ink-dark">
                    Generisi AI opis
                  </Text>
                  <Text className="mt-0.5 font-sans text-xs text-ink-dark/50">
                    AI analizira sliku i predlaze opis na prirodnom srpskom
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
              </View>
            </TouchableOpacity>
          ) : (
            <View className="mt-6 flex-row items-center rounded-[20px] bg-brand-highlight/20 px-4 py-3">
              <Ionicons name="checkmark-circle" size={20} color={colors.accentDeep} />
              <Text className="ml-2 flex-1 font-sans text-sm text-ink-dark/70">
                AI opis je generisan. Naslov ostaje tvoj, a tekst mozes odmah da izmenis ispod.
              </Text>
              <TouchableOpacity onPress={generateAiDescription}>
                <Ionicons name="refresh" size={18} color={colors.accentDeep} />
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View className="my-6 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-ink-dark/8" />
            <Text className="font-sans text-xs text-ink-dark/30">
              {generated ? 'Izmeni ili ostavi' : 'Ili popuni rucno'}
            </Text>
            <View className="h-px flex-1 bg-ink-dark/8" />
          </View>

          {/* Title */}
          <View>
            <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">Naslov</Text>
            <VelveTextInput
              ref={titleInputRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Ti smisli naslov svog komada"
              className="rounded-[20px] border border-ink-dark/8 bg-surface-panel px-5 py-4 font-sans text-sm text-ink-dark"
            />
          </View>

          {/* Description */}
          <View className="mt-4">
            <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">Opis</Text>
            <VelveTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Opisi komad prirodno: boja, kroj, detalji, stanje..."
              multiline
              textAlignVertical="top"
              className="min-h-[140px] rounded-[20px] border border-ink-dark/8 bg-surface-panel px-5 py-4 font-sans text-sm leading-6 text-ink-dark"
            />
          </View>

          {/* Summary chips */}
          <View className="mt-6 flex-row flex-wrap gap-2">
            {params.category ? (
              <View className="rounded-full bg-brand-accent-light/20 px-3 py-1.5">
                <Text className="font-sans text-xs font-semibold text-brand-accent-deep">
                  {params.category}
                </Text>
              </View>
            ) : null}
            {params.brand ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">{params.brand}</Text>
              </View>
            ) : null}
            {params.size ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">{params.size}</Text>
              </View>
            ) : null}
            {params.listingType ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">
                  {params.listingType === 'trade'
                    ? 'Razmena'
                    : params.listingType === 'sell'
                      ? 'Prodaja'
                      : 'Razmena + Prodaja'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-base-canvas px-5 pt-3"
        style={{
          paddingBottom: insets.bottom + 12,
          shadowColor: '#2B2A2B',
          shadowOpacity: 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
          elevation: 6,
        }}
      >
        <TouchableOpacity
          disabled={saving}
          onPress={() => publish('available')}
          className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.baseCanvas} />
          ) : (
            <Text className="font-sans text-base font-semibold text-base-canvas">
              Objavi
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={saving}
          onPress={() => publish('draft')}
          className="mt-2 items-center rounded-full px-4 py-3"
        >
          <Text className="font-sans text-sm font-semibold text-ink-dark/50">
            Sacuvaj kao draft
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  )
}
