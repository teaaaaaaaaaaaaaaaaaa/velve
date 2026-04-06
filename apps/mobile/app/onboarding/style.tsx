import { useMemo, useState } from 'react'
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

const STYLE_OPTIONS = [
  {
    id: 'casual',
    icon: 'shirt-outline',
    label: { sr: 'Casual', en: 'Casual', ru: 'Casual' },
    note: {
      sr: 'Mekan layering i easy komadi.',
      en: 'Soft layering and easy pieces.',
      ru: 'Мягкий layering и легкие вещи.',
    },
  },
  {
    id: 'street',
    icon: 'flash-outline',
    label: { sr: 'Street', en: 'Street', ru: 'Street' },
    note: {
      sr: 'Graficki momenti i attitude.',
      en: 'Graphic moments and attitude.',
      ru: 'Графичные акценты и attitude.',
    },
  },
  {
    id: 'vintage',
    icon: 'time-outline',
    label: { sr: 'Vintage', en: 'Vintage', ru: 'Vintage' },
    note: {
      sr: 'Second-life komadi sa pricom.',
      en: 'Second-life pieces with a story.',
      ru: 'Вещи с историей и second-life vibe.',
    },
  },
  {
    id: 'luxury',
    icon: 'diamond-outline',
    label: { sr: 'Luxury', en: 'Luxury', ru: 'Luxury' },
    note: {
      sr: 'Ciste linije i premium signal.',
      en: 'Clean lines and a premium signal.',
      ru: 'Чистые линии и premium signal.',
    },
  },
  {
    id: 'sportswear',
    icon: 'tennisball-outline',
    label: { sr: 'Sportswear', en: 'Sportswear', ru: 'Sportswear' },
    note: {
      sr: 'Aktivna silueta i komfor.',
      en: 'Active silhouettes and comfort.',
      ru: 'Активный силуэт и комфорт.',
    },
  },
  {
    id: 'minimalist',
    icon: 'remove-outline',
    label: { sr: 'Minimal', en: 'Minimal', ru: 'Minimal' },
    note: {
      sr: 'Tih luksuz i precizan izbor.',
      en: 'Quiet luxury and precise choices.',
      ru: 'Тихая роскошь и точный выбор.',
    },
  },
  {
    id: 'bohemian',
    icon: 'flower-outline',
    label: { sr: 'Boho', en: 'Boho', ru: 'Boho' },
    note: {
      sr: 'Tekstura, slojevi i fluidnost.',
      en: 'Texture, layers, and fluid motion.',
      ru: 'Текстура, слои и плавность.',
    },
  },
  {
    id: 'grunge',
    icon: 'skull-outline',
    label: { sr: 'Grunge', en: 'Grunge', ru: 'Grunge' },
    note: {
      sr: 'Tamni tonovi i raw karakter.',
      en: 'Dark tones and raw character.',
      ru: 'Темные тона и raw характер.',
    },
  },
] as const

const COPY = {
  sr: {
    step: 'Korak 2 od 5',
    mood: 'taste curation',
    title: 'Od kojih stilova zelis da feed krene?',
    description:
      'Izaberi modne signale koji ti deluju kao tvoja scena. Mozes oznaciti vise pravaca.',
    footerHint: 'Izaberi makar jedan stil da Velve uhvati tvoj ritam.',
    cta: 'Nastavi',
  },
  en: {
    step: 'Step 2 of 5',
    mood: 'taste curation',
    title: 'Which style directions should shape your feed first?',
    description:
      'Pick the fashion signals that feel like your scene. You can select more than one.',
    footerHint: 'Choose at least one style so Velve can catch your rhythm.',
    cta: 'Continue',
  },
  ru: {
    step: 'Шаг 2 из 5',
    mood: 'taste curation',
    title: 'С каких стилевых направлений должна начаться твоя лента?',
    description:
      'Выбери модные сигналы, которые ощущаются как твоя сцена. Можно отметить несколько.',
    footerHint: 'Выбери хотя бы один стиль, чтобы Velve поймал твой ритм.',
    cta: 'Продолжить',
  },
} as const

export default function StyleScreen() {
  const router = useRouter()
  const { locale } = useI18n()
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])

  const copy = COPY[locale]
  const selectedCountLabel = useMemo(() => `${selectedStyles.length}/8`, [selectedStyles.length])

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((style) => style !== id) : [...prev, id]
    )
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <View className="px-gutter pb-4 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-base-canvas/82"
        >
          <Ionicons name="arrow-back" size={20} color={colors.accentDeep} />
        </TouchableOpacity>

        <View className="self-start rounded-pill bg-brand-accent-deep/8 px-4 py-2">
          <Text className="font-sans text-xs uppercase tracking-[1.2px] text-brand-accent-deep">
            {copy.step}
          </Text>
        </View>

        <View className="mt-4 h-2 overflow-hidden rounded-full bg-ink-dark/8">
          <View className="h-full w-2/5 rounded-full bg-brand-accent-deep" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-gutter"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-logo text-[30px] leading-none text-brand-accent-deep/72">
          {copy.mood}
        </Text>
        <Text className="mt-4 font-display text-[38px] leading-[40px] text-ink-dark">
          {copy.title}
        </Text>
        <Text className="mt-4 max-w-[340px] font-sans text-base leading-7 text-ink-dark/68">
          {copy.description}
        </Text>

        <GlassSurface className="mt-6 flex-row items-center justify-between px-5 py-4">
          <View>
            <Text className="font-display text-2xl text-ink-dark">{selectedCountLabel}</Text>
            <Text className="mt-1 font-sans text-sm text-ink-dark/58">{copy.footerHint}</Text>
          </View>
          <View className="rounded-pill bg-brand-highlight/38 px-4 py-2">
            <Text className="font-sans text-xs uppercase tracking-[1px] text-ink-dark">
              Velve
            </Text>
          </View>
        </GlassSurface>

        <View className="mt-6 flex-row flex-wrap justify-between">
          {STYLE_OPTIONS.map((style) => {
            const isSelected = selectedStyles.includes(style.id)

            return (
              <TouchableOpacity
                key={style.id}
                onPress={() => toggleStyle(style.id)}
                className={`mb-4 overflow-hidden rounded-card border px-4 py-5 ${
                  isSelected
                    ? 'border-brand-accent-deep bg-brand-accent-deep'
                    : 'border-base-canvas/70 bg-base-canvas/78'
                }`}
                style={{ width: '48%' }}
              >
                <View className="flex-row items-start justify-between">
                  <View
                    className={`h-11 w-11 items-center justify-center rounded-full ${
                      isSelected ? 'bg-base-canvas/14' : 'bg-brand-accent-light/28'
                    }`}
                  >
                    <Ionicons
                      name={style.icon}
                      size={22}
                      color={isSelected ? colors.baseCanvas : colors.accentDeep}
                    />
                  </View>

                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.highlight} />
                  ) : null}
                </View>

                <Text
                  className={`mt-5 font-display text-[24px] leading-6 ${
                    isSelected ? 'text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {style.label[locale]}
                </Text>
                <Text
                  className={`mt-2 font-sans text-sm leading-6 ${
                    isSelected ? 'text-base-canvas/74' : 'text-ink-dark/60'
                  }`}
                >
                  {style.note[locale]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/onboarding/categories',
              params: {
                styles: JSON.stringify(selectedStyles),
              },
            })
          }
          disabled={selectedStyles.length === 0}
          className={`items-center rounded-pill px-5 py-4 ${
            selectedStyles.length ? 'bg-brand-accent-deep' : 'bg-ink-dark/16'
          }`}
        >
          <Text
            className={`font-sans text-base font-semibold ${
              selectedStyles.length ? 'text-base-canvas' : 'text-ink-dark/42'
            }`}
          >
            {copy.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
