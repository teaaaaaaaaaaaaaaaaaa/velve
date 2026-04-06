import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

const SERBIAN_CITIES = [
  'Beograd',
  'Novi Sad',
  'Nis',
  'Kragujevac',
  'Subotica',
  'Zrenjanin',
  'Pancevo',
  'Cacak',
  'Krusevac',
  'Leskovac',
  'Smederevo',
  'Novi Pazar',
  'Valjevo',
  'Sabac',
  'Uzice',
  'Sombor',
  'Kikinda',
  'Sremska Mitrovica',
  'Vrsac',
  'Vranje',
] as const

const COPY = {
  sr: {
    step: 'Korak 5 od 5',
    mood: 'final fit',
    title: 'Zavrsi profil detaljima koji cine trade smislenim.',
    description:
      'Velicine i grad drze discovery korisnim, a trade predloge realnim i brzim.',
    clothing: 'Velicina odece',
    shoeSize: 'Broj obuce',
    shoePlaceholder: 'npr. 39',
    shoeHint: 'Unesi broj od 36 do 47.',
    city: 'Tvoj grad',
    successTitle: 'Spremno je za launch',
    successDescription: 'Jos jedan tap i ulazis u discovery koji je prilagodjen tebi.',
    cta: 'Zavrsi',
    errorTitle: 'Greska',
    errorFallback: 'Doslo je do greske. Pokusaj ponovo.',
  },
  en: {
    step: 'Step 5 of 5',
    mood: 'final fit',
    title: 'Finish the profile with details that make trading feel real.',
    description:
      'Sizes and city keep discovery useful and make trade proposals feel grounded and fast.',
    clothing: 'Clothing size',
    shoeSize: 'Shoe size',
    shoePlaceholder: 'for example 39',
    shoeHint: 'Enter a size between 36 and 47.',
    city: 'Your city',
    successTitle: 'Ready for launch',
    successDescription: 'One more tap and you enter a discovery flow shaped around you.',
    cta: 'Finish',
    errorTitle: 'Error',
    errorFallback: 'Something went wrong. Please try again.',
  },
  ru: {
    step: 'Шаг 5 из 5',
    mood: 'final fit',
    title: 'Заверши профиль деталями, которые делают trade реальным.',
    description:
      'Размеры и город держат discovery полезным, а trade-предложения понятными и быстрыми.',
    clothing: 'Размер одежды',
    shoeSize: 'Размер обуви',
    shoePlaceholder: 'например 39',
    shoeHint: 'Введи размер от 36 до 47.',
    city: 'Твой город',
    successTitle: 'Все готово к запуску',
    successDescription: 'Еще один тап, и ты входишь в discovery, собранный под тебя.',
    cta: 'Завершить',
    errorTitle: 'Ошибка',
    errorFallback: 'Что-то пошло не так. Попробуй еще раз.',
  },
} as const

function parseJsonArray(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function AboutScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { locale } = useI18n()
  const [clothingSize, setClothingSize] = useState<string>('')
  const [shoeSize, setShoeSize] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const copy = COPY[locale]
  const shoeValue = Number.parseInt(shoeSize, 10)
  const isValid =
    Boolean(clothingSize) &&
    Number.isFinite(shoeValue) &&
    shoeValue >= 36 &&
    shoeValue <= 47 &&
    Boolean(selectedCity)

  const onboardingData = useMemo(
    () => ({
      stylePreferences: parseJsonArray(params.styles as string | undefined),
      favoriteBrands: parseJsonArray(params.brands as string | undefined),
      categories: parseJsonArray(params.categories as string | undefined),
      sizes: {
        clothing: clothingSize,
        shoes: shoeSize,
      },
      location: {
        city: selectedCity,
        region: 'Srbija',
      },
    }),
    [clothingSize, params.brands, params.categories, params.styles, selectedCity, shoeSize]
  )

  const submitOnboarding = async () => {
    try {
      await client.put('/api/users/me/onboarding', onboardingData)
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error
      }

      try {
        await client.post('/api/users/me/onboarding', onboardingData)
      } catch (postError: any) {
        if (postError.response?.status !== 404) {
          throw postError
        }

        await client.put('/api/users/me', onboardingData)
      }
    }
  }

  const handleFinish = async () => {
    if (!isValid) return

    try {
      setLoading(true)
      await submitOnboarding()
      router.push('/onboarding/success')
    } catch (error: any) {
      Alert.alert(copy.errorTitle, error.response?.data?.error || copy.errorFallback)
    } finally {
      setLoading(false)
    }
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
          <View className="h-full w-full rounded-full bg-brand-accent-deep" />
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
            {copy.clothing}
          </Text>
          <View className="mt-4 flex-row flex-wrap justify-between">
            {CLOTHING_SIZES.map((size) => {
              const isSelected = clothingSize === size
              return (
                <TouchableOpacity
                  key={size}
                  onPress={() => setClothingSize(size)}
                  className={`mb-3 items-center justify-center rounded-soft border px-4 py-4 ${
                    isSelected
                      ? 'border-brand-accent-deep bg-brand-accent-deep'
                      : 'border-brand-accent-deep/10 bg-base-canvas'
                  }`}
                  style={{ width: '31%' }}
                >
                  <Text
                    className={`font-display text-[26px] ${
                      isSelected ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </GlassSurface>

        <GlassSurface className="mt-5 px-5 py-5">
          <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/44">
            {copy.shoeSize}
          </Text>
          <View className="mt-3 flex-row items-center rounded-pill bg-base-canvas px-4 py-3">
            <Ionicons name="footsteps-outline" size={18} color={colors.accentDeep} />
            <TextInput
              value={shoeSize}
              onChangeText={(nextValue) => setShoeSize(nextValue.replace(/[^0-9]/g, ''))}
              placeholder={copy.shoePlaceholder}
              placeholderTextColor="rgba(43,42,43,0.46)"
              className="ml-3 flex-1 font-sans text-sm text-ink-dark"
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
          <Text className="mt-3 font-sans text-sm text-ink-dark/52">{copy.shoeHint}</Text>
        </GlassSurface>

        <GlassSurface className="mt-5 px-5 py-5">
          <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/44">
            {copy.city}
          </Text>
          <View className="mt-4 flex-row flex-wrap justify-between">
            {SERBIAN_CITIES.map((city) => {
              const isSelected = selectedCity === city
              return (
                <TouchableOpacity
                  key={city}
                  onPress={() => setSelectedCity(city)}
                  className={`mb-3 flex-row items-center justify-between rounded-soft border px-4 py-4 ${
                    isSelected
                      ? 'border-brand-accent-deep bg-brand-accent-deep'
                      : 'border-brand-accent-deep/10 bg-base-canvas'
                  }`}
                  style={{ width: '48%' }}
                >
                  <Text
                    className={`font-sans text-sm ${
                      isSelected ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {city}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.highlight} />
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </View>
        </GlassSurface>

        {isValid ? (
          <View className="mt-5 rounded-card border border-brand-highlight/40 bg-brand-highlight/26 px-5 py-4">
            <Text className="font-display text-[26px] text-ink-dark">{copy.successTitle}</Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/72">
              {copy.successDescription}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          onPress={handleFinish}
          disabled={!isValid || loading}
          className={`items-center rounded-pill px-5 py-4 ${
            isValid && !loading ? 'bg-brand-highlight' : 'bg-ink-dark/16'
          }`}
        >
          {loading ? (
            <ActivityIndicator color={colors.inkDark} />
          ) : (
            <Text
              className={`font-sans text-base font-semibold ${
                isValid ? 'text-ink-dark' : 'text-ink-dark/42'
              }`}
            >
              {copy.cta}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
