import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

const SUGGESTED_BRANDS = [
  'Nike',
  'Adidas',
  'Zara',
  'Mango',
  'Reserved',
  'Bershka',
  'New Balance',
  'Converse',
  "Levi's",
  'COS',
  'Arket',
  'Diesel',
] as const

const COPY = {
  sr: {
    step: 'Korak 4 od 5',
    mood: 'label language',
    title: 'Koji brendovi zvuce kao tvoj modni jezik?',
    description:
      'Dodaj one etikete koje najcesce trazis ili otvaras kada zelis da discovery odmah klikne.',
    inputPlaceholder: 'Dodaj svoj brend...',
    selected: 'Izabrano',
    suggested: 'Predlozeni brendovi',
    cta: 'Nastavi',
  },
  en: {
    step: 'Step 4 of 5',
    mood: 'label language',
    title: 'Which brands sound like your fashion language?',
    description:
      'Add the labels you look for most often so discovery lands closer to your taste immediately.',
    inputPlaceholder: 'Add your own brand...',
    selected: 'Selected',
    suggested: 'Suggested brands',
    cta: 'Continue',
  },
  ru: {
    step: 'Шаг 4 из 5',
    mood: 'label language',
    title: 'Какие бренды звучат как твой модный язык?',
    description:
      'Добавь те лейблы, которые ты чаще всего ищешь, чтобы discovery сразу попадал ближе к твоему вкусу.',
    inputPlaceholder: 'Добавь свой бренд...',
    selected: 'Выбрано',
    suggested: 'Предложенные бренды',
    cta: 'Продолжить',
  },
} as const

export default function BrandsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { locale } = useI18n()
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [customBrand, setCustomBrand] = useState('')

  const copy = COPY[locale]
  const availableBrands = useMemo(
    () => SUGGESTED_BRANDS.filter((brand) => !selectedBrands.includes(brand)),
    [selectedBrands]
  )

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((currentBrand) => currentBrand !== brand) : [...prev, brand]
    )
  }

  const addCustomBrand = () => {
    const trimmedBrand = customBrand.trim()
    if (!trimmedBrand || selectedBrands.includes(trimmedBrand)) return

    setSelectedBrands((prev) => [...prev, trimmedBrand])
    setCustomBrand('')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-base-canvas"
    >
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
          <View className="h-full w-4/5 rounded-full bg-brand-accent-deep" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-gutter"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-logo text-[30px] leading-none text-brand-accent-deep/72">
          {copy.mood}
        </Text>
        <Text className="mt-4 font-display text-[38px] leading-[40px] text-ink-dark">
          {copy.title}
        </Text>
        <Text className="mt-4 max-w-[344px] font-sans text-base leading-7 text-ink-dark/68">
          {copy.description}
        </Text>

        <GlassSurface className="mt-6 px-5 py-5">
          <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/44">
            Velve edit
          </Text>
          <View className="mt-3 flex-row items-center rounded-pill bg-base-canvas px-4 py-3">
            <TextInput
              value={customBrand}
              onChangeText={setCustomBrand}
              onSubmitEditing={addCustomBrand}
              placeholder={copy.inputPlaceholder}
              placeholderTextColor="rgba(43,42,43,0.46)"
              className="flex-1 font-sans text-sm text-ink-dark"
              returnKeyType="done"
            />

            <TouchableOpacity
              onPress={addCustomBrand}
              disabled={!customBrand.trim()}
              className={`ml-3 h-10 w-10 items-center justify-center rounded-full ${
                customBrand.trim() ? 'bg-brand-highlight' : 'bg-ink-dark/12'
              }`}
            >
              <Ionicons
                name="add"
                size={20}
                color={customBrand.trim() ? colors.inkDark : 'rgba(43,42,43,0.32)'}
              />
            </TouchableOpacity>
          </View>
        </GlassSurface>

        {selectedBrands.length ? (
          <View className="mt-6">
            <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/46">
              {copy.selected} ({selectedBrands.length})
            </Text>
            <View className="mt-3 flex-row flex-wrap">
              {selectedBrands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  onPress={() => toggleBrand(brand)}
                  className="mb-3 mr-3 flex-row items-center rounded-pill bg-brand-accent-deep px-4 py-3"
                >
                  <Text className="mr-2 font-sans text-sm font-medium text-base-canvas">
                    {brand}
                  </Text>
                  <Ionicons name="close" size={16} color={colors.baseCanvas} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-4">
          <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/46">
            {copy.suggested}
          </Text>

          <View className="mt-3 flex-row flex-wrap">
            {availableBrands.map((brand) => (
              <TouchableOpacity
                key={brand}
                onPress={() => toggleBrand(brand)}
                className="mb-3 mr-3 rounded-pill border border-brand-accent-deep/10 bg-base-canvas/82 px-4 py-3"
              >
                <Text className="font-sans text-sm text-ink-dark">{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/onboarding/about',
              params: {
                ...params,
                brands: JSON.stringify(selectedBrands),
              },
            })
          }
          disabled={selectedBrands.length === 0}
          className={`items-center rounded-pill px-5 py-4 ${
            selectedBrands.length ? 'bg-brand-accent-deep' : 'bg-ink-dark/16'
          }`}
        >
          <Text
            className={`font-sans text-base font-semibold ${
              selectedBrands.length ? 'text-base-canvas' : 'text-ink-dark/42'
            }`}
          >
            {copy.cta}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
