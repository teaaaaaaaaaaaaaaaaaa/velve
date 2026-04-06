import { useEffect, useState } from 'react'
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { BrandedLoader } from '@/components/BrandedLoader'
import { GlassSurface } from '@/components/GlassSurface'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

type PreviewItem = {
  _id: string
  title: string
  brand?: string
  size?: string
  imageUrl?: string
  user?: {
    displayName?: string
  }
}

const COPY = {
  sr: {
    loading: 'Velve sprema tvoj prvi discovery kadar',
    mood: 'soft launch',
    title: 'Profil je spreman. Discovery sada izgleda kao tvoj prostor.',
    description:
      'Pre nego sto udjes u feed, evo nekoliko komada koji odgovaraju signalima koje si upravo ostavila.',
    emptyTitle: 'Discovery je spreman za prvi refresh',
    emptyDescription:
      'I bez preview selekcije, feed je sada konfigurisan da krene iz tvog modnog ritma.',
    cta: 'Udji u feed',
  },
  en: {
    loading: 'Velve is preparing your first discovery frame',
    mood: 'soft launch',
    title: 'Your profile is ready. Discovery now feels like your own space.',
    description:
      'Before you enter the feed, here are a few pieces that match the signals you just left behind.',
    emptyTitle: 'Discovery is ready for its first refresh',
    emptyDescription:
      'Even without a preview selection, the feed is now configured to start from your fashion rhythm.',
    cta: 'Enter feed',
  },
  ru: {
    loading: 'Velve готовит твой первый discovery-кадр',
    mood: 'soft launch',
    title: 'Профиль готов. Discovery теперь ощущается как твое собственное пространство.',
    description:
      'Перед входом в ленту вот несколько вещей, которые совпадают с сигналами, которые ты только что оставила.',
    emptyTitle: 'Discovery готов к первому refresh',
    emptyDescription:
      'Даже без preview-подборки лента уже настроена стартовать из твоего модного ритма.',
    cta: 'Войти в ленту',
  },
} as const

export default function SuccessScreen() {
  const router = useRouter()
  const { locale } = useI18n()
  const [items, setItems] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(true)

  const copy = COPY[locale]

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const response = await client.get('/api/feed?limit=3')
        if (response.data.ok) {
          setItems(response.data.data ?? [])
        }
      } catch (error) {
        console.error('[Success] Failed to fetch preview items', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreview()
  }, [])

  if (loading) {
    return <BrandedLoader label={copy.loading} />
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <ScrollView
        className="flex-1 px-gutter"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 70 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-start">
          <BrandWordmark width={210} />
          <Text className="mt-5 font-logo text-[34px] leading-none text-brand-accent-deep/72">
            {copy.mood}
          </Text>
          <Text className="mt-5 font-display text-[42px] leading-[44px] text-ink-dark">
            {copy.title}
          </Text>
          <Text className="mt-4 max-w-[344px] font-sans text-base leading-7 text-ink-dark/68">
            {copy.description}
          </Text>
        </View>

        {items.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-8"
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {items.map((item, index) => (
              <GlassSurface
                key={item._id}
                className="mr-4 overflow-hidden"
                style={{ width: 252, transform: [{ translateY: index === 1 ? 16 : 0 }] }}
              >
                <RemoteImage
                  uri={item.imageUrl}
                  style={{ height: 320 }}
                  loaderColor={colors.accentDeep}
                  fallback={
                    <View className="h-[320px] items-center justify-center bg-brand-accent-deep">
                      <Ionicons name="sparkles-outline" size={30} color={colors.baseCanvas} />
                    </View>
                  }
                />
                <View className="px-4 py-4">
                  <Text className="font-display text-[28px] leading-7 text-ink-dark">
                    {item.title}
                  </Text>
                  <Text className="mt-2 font-sans text-sm text-ink-dark/64">
                    {[item.brand, item.size].filter(Boolean).join(' · ')}
                  </Text>
                  <Text className="mt-3 font-sans text-xs uppercase tracking-[1px] text-ink-dark/46">
                    {item.user?.displayName || 'Velve'}
                  </Text>
                </View>
              </GlassSurface>
            ))}
          </ScrollView>
        ) : (
          <GlassSurface className="mt-8 px-5 py-6">
            <Text className="font-display text-[28px] leading-7 text-ink-dark">
              {copy.emptyTitle}
            </Text>
            <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/68">
              {copy.emptyDescription}
            </Text>
          </GlassSurface>
        )}
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          className="items-center rounded-pill bg-brand-accent-deep px-5 py-4"
          onPress={() => router.replace('/(tabs)/feed')}
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">{copy.cta}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
