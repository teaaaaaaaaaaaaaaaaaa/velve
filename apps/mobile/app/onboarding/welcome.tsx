import { useRouter } from 'expo-router'
import { StatusBar, Text, TouchableOpacity, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { GlassSurface } from '@/components/GlassSurface'
import { useI18n } from '@/i18n'

export default function WelcomeScreen() {
  const router = useRouter()
  const { locale, t } = useI18n()

  const helperCopy = {
    sr: 'Discovery first. Marketplace second. Stil je uvek u fokusu.',
    en: 'Discovery first. Marketplace second. Style stays in focus.',
    ru: 'Discovery first. Marketplace second. Стиль всегда в фокусе.',
  } as const

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <View className="flex-1 px-gutter pb-12 pt-16">
        <View className="rounded-pill bg-brand-accent-deep/8 px-4 py-2 self-start">
          <Text className="font-sans text-xs uppercase tracking-[1.3px] text-brand-accent-deep">
            {t('onboarding.welcomeStep')}
          </Text>
        </View>

        <View className="mt-4 h-2 overflow-hidden rounded-full bg-ink-dark/8">
          <View className="h-full w-1/5 rounded-full bg-brand-accent-deep" />
        </View>

        <View className="flex-1 justify-center">
          <BrandWordmark width={210} />
          <Text className="mt-6 font-logo text-[36px] leading-none text-brand-accent-deep/70">
            {t('onboarding.welcomeMood')}
          </Text>
          <Text className="mt-5 font-display text-[44px] leading-[46px] text-ink-dark">
            {t('onboarding.welcomeTitle')}
          </Text>
          <Text className="mt-5 max-w-[330px] font-sans text-base leading-7 text-ink-dark/68">
            {t('onboarding.welcomeDescription')}
          </Text>
        </View>

        <GlassSurface className="px-5 py-5">
          <Text className="font-display text-2xl text-ink-dark">Velve</Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/62">
            {helperCopy[locale]}
          </Text>

          <TouchableOpacity
            className="mt-5 items-center rounded-pill bg-brand-accent-deep px-4 py-4"
            onPress={() => router.push('/onboarding/style')}
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {t('onboarding.start')}
            </Text>
          </TouchableOpacity>
        </GlassSurface>
      </View>
    </View>
  )
}
