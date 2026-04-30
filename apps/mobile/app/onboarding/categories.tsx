import { useState } from 'react'
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { OnboardingAnimatedBlock } from '@/components/OnboardingAnimatedBlock'
import { OnboardingProgressHeader } from '@/components/OnboardingProgressHeader'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

const CATEGORY_OPTIONS = [
  {
    id: 'Tops',
    icon: 'shirt-outline',
    label: { sr: 'Tops', en: 'Tops', ru: 'Tops' },
    note: {
      sr: 'Majice, kosulje i layering baza.',
      en: 'Tees, shirts, and layering bases.',
      ru: 'Футболки, рубашки и база для layering.',
    },
  },
  {
    id: 'Haljine',
    icon: 'woman-outline',
    label: { sr: 'Haljine', en: 'Dresses', ru: 'Платья' },
    note: {
      sr: 'Od dnevnih do statement silueta.',
      en: 'From daytime to statement silhouettes.',
      ru: 'От дневных до statement silhouettes.',
    },
  },
  {
    id: 'Pantalone',
    icon: 'git-compare-outline',
    label: { sr: 'Pantalone', en: 'Trousers', ru: 'Брюки' },
    note: {
      sr: 'Tailoring, denim i relaxed fit.',
      en: 'Tailoring, denim, and relaxed fits.',
      ru: 'Tailoring, denim и relaxed fit.',
    },
  },
  {
    id: 'Suknje',
    icon: 'filter-outline',
    label: { sr: 'Suknje', en: 'Skirts', ru: 'Юбки' },
    note: {
      sr: 'Mini, midi i fluidni volumen.',
      en: 'Mini, midi, and fluid volume.',
      ru: 'Мини, миди и плавный объем.',
    },
  },
  {
    id: 'Jakne',
    icon: 'shield-outline',
    label: { sr: 'Jakne', en: 'Outerwear', ru: 'Верхняя одежда' },
    note: {
      sr: 'Statement sloj koji zakljuca look.',
      en: 'The layer that locks the look in.',
      ru: 'Слой, который собирает весь образ.',
    },
  },
  {
    id: 'Dzemperi',
    icon: 'snow-outline',
    label: { sr: 'Dzemperi', en: 'Knitwear', ru: 'Трикотаж' },
    note: {
      sr: 'Mekane teksture i cozy linije.',
      en: 'Soft textures and cozy lines.',
      ru: 'Мягкие текстуры и cozy линии.',
    },
  },
  {
    id: 'Patike',
    icon: 'walk-outline',
    label: { sr: 'Patike', en: 'Sneakers', ru: 'Кроссовки' },
    note: {
      sr: 'Svaki dan, svaki vibe.',
      en: 'Everyday movement with style.',
      ru: 'Движение каждый день со стилем.',
    },
  },
  {
    id: 'Torbe',
    icon: 'bag-handle-outline',
    label: { sr: 'Torbe', en: 'Bags', ru: 'Сумки' },
    note: {
      sr: 'Prakticno, ali sa karakterom.',
      en: 'Practical, but never flat.',
      ru: 'Практично, но с характером.',
    },
  },
] as const

const COPY = {
  sr: {
    step: 'Korak 3 od 5',
    mood: 'discovery map',
    title: 'Koje kategorije treba da nose tvoj discovery?',
    description:
      'Ovo pomaze da feed ne bude genericna masa, vec selekcija koja prati tvoj orman.',
    helper: 'Biraj komade koje zelis da otvaras iznova.',
    cta: 'Nastavi',
  },
  en: {
    step: 'Step 3 of 5',
    mood: 'discovery map',
    title: 'Which categories should drive your discovery layer?',
    description:
      'This keeps the feed from becoming generic and turns it into a wardrobe-shaped selection.',
    helper: 'Choose the pieces you want to keep opening again.',
    cta: 'Continue',
  },
  ru: {
    step: 'Шаг 3 из 5',
    mood: 'discovery map',
    title: 'Какие категории должны вести твой discovery-слой?',
    description:
      'Так лента не превращается в общую массу, а начинает ощущаться как выборка под твой гардероб.',
    helper: 'Выбери вещи, которые хочется открывать снова и снова.',
    cta: 'Продолжить',
  },
} as const

export default function CategoriesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { locale } = useI18n()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const copy = COPY[locale]
  const unlockLabel = locale === 'sr' ? 'Otkljucana mapa feeda' : 'Feed map unlocked'

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((category) => category !== id) : [...prev, id]
    )
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <OnboardingProgressHeader
        stepLabel={copy.step.replace('5', '6')}
        progress={3 / 6}
        unlockLabel={unlockLabel}
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1 px-gutter"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingAnimatedBlock>
          <Text className="font-logo text-[30px] leading-none text-brand-accent-deep/72">
            {copy.mood}
          </Text>
          <Text className="mt-4 font-display text-[38px] leading-[40px] text-ink-dark">
            {copy.title}
          </Text>
          <Text className="mt-4 max-w-[344px] font-sans text-base leading-7 text-ink-dark/68">
            {copy.description}
          </Text>
        </OnboardingAnimatedBlock>

        <OnboardingAnimatedBlock delay={90}>
          <GlassSurface className="mt-6 px-5 py-4">
            <Text className="font-sans text-sm leading-6 text-ink-dark/62">{copy.helper}</Text>
          </GlassSurface>
        </OnboardingAnimatedBlock>

        <OnboardingAnimatedBlock delay={160} className="mt-6 flex-row flex-wrap justify-between">
          {CATEGORY_OPTIONS.map((category) => {
            const isSelected = selectedCategories.includes(category.id)

            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => toggleCategory(category.id)}
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
                      name={category.icon}
                      size={22}
                      color={isSelected ? colors.baseCanvas : colors.accentDeep}
                    />
                  </View>

                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.highlight} />
                  ) : null}
                </View>

                <Text
                  className={`mt-5 font-display text-[22px] leading-6 ${
                    isSelected ? 'text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {category.label[locale]}
                </Text>
                <Text
                  className={`mt-2 font-sans text-sm leading-6 ${
                    isSelected ? 'text-base-canvas/74' : 'text-ink-dark/60'
                  }`}
                >
                  {category.note[locale]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </OnboardingAnimatedBlock>
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/onboarding/brands',
              params: {
                ...params,
                categories: JSON.stringify(selectedCategories),
              },
            })
          }
          disabled={selectedCategories.length === 0}
          className={`items-center rounded-pill px-5 py-4 ${
            selectedCategories.length ? 'bg-brand-accent-deep' : 'bg-ink-dark/16'
          }`}
        >
          <Text
            className={`font-sans text-base font-semibold ${
              selectedCategories.length ? 'text-base-canvas' : 'text-ink-dark/42'
            }`}
          >
            {copy.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
