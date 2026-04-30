import { StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { OnboardingAnimatedBlock } from '@/components/OnboardingAnimatedBlock'
import { OnboardingProgressHeader } from '@/components/OnboardingProgressHeader'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { markBodyScanSkippedThisSession } from '@/lib/vtoSession'

const COPY = {
  sr: {
    mood: 'body scanner',
    title: 'Skeniraj se za Virtual Try-On ormar.',
    description:
      'Napravi digitalni duplikat sebe da bi mogao da probavas garderobu pre razmene. Slika se cuva anonimno.',
    prepTitle: 'Priprema',
    prepDescription:
      'Stani ispred kamere celim telom, drzi telefon mirno i ostavi malo praznog prostora iznad glave.',
    cta: 'Zapocni skener',
    skip: 'Preskoci za sada',
  },
  en: {
    mood: 'body scanner',
    title: 'Scan yourself for the Virtual Try-On closet.',
    description:
      'Create a digital duplicate of yourself so you can try on clothes before trading. The image is stored anonymously.',
    prepTitle: 'Preparation',
    prepDescription:
      'Stand in front of the camera with your full body, hold the phone steady, and leave some space above your head.',
    cta: 'Start scanner',
    skip: 'Skip for now',
  },
  ru: {
    mood: 'body scanner',
    title: 'Отсканируй себя для Virtual Try-On гардероба.',
    description:
      'Создай свой цифровой дубликат, чтобы примерять вещи перед обменом. Изображение хранится анонимно.',
    prepTitle: 'Подготовка',
    prepDescription:
      'Встань перед камерой в полный рост, держи телефон ровно и оставь немного пространства над головой.',
    cta: 'Начать сканер',
    skip: 'Пропустить',
  },
} as const

export default function OnboardingScanScreen() {
  const router = useRouter()
  const { locale } = useI18n()

  const copy = COPY[locale]
  const unlockLabel = locale === 'sr' ? 'Virtual Try-On spreman' : 'Virtual Try-On ready'

  const handleSkip = () => {
    markBodyScanSkippedThisSession()
    router.replace('/(tabs)/feed')
  }

  const handleStartScan = () => {
    router.push('/vto/body-scan-camera')
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <View className="flex-1 justify-between pb-10">
        <View>
          <OnboardingProgressHeader
            stepLabel="VTO setup"
            progress={1}
            unlockLabel={unlockLabel}
          />
          <TouchableOpacity
            onPress={handleSkip}
            className="absolute right-5 top-14 z-20 rounded-full bg-surface-panel px-4 py-2.5"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark/60">
              {copy.skip}
            </Text>
          </TouchableOpacity>
          <OnboardingAnimatedBlock className="px-gutter">
            <View className="mb-4 self-start rounded-full bg-brand-highlight/30 px-3 py-1.5">
              <Text className="font-sans text-xs font-semibold uppercase text-ink-dark/55">
                Opcionalno
              </Text>
            </View>
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
        </View>

        <GlassSurface className="mx-gutter px-5 py-6">
          <View className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-accent-deep/10">
              <Ionicons name="body-outline" size={40} color={colors.accentDeep} />
            </View>
          </View>
          <Text className="mt-5 text-center font-display text-[26px] text-ink-dark">
            {copy.prepTitle}
          </Text>
          <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/65">
            {copy.prepDescription}
          </Text>
        </GlassSurface>

        <View className="px-gutter">
          <TouchableOpacity
            onPress={handleStartScan}
            className="items-center rounded-pill bg-brand-accent-deep px-5 py-4"
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {copy.cta}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  )
}
