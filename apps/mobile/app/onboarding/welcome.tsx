import { useRouter } from 'expo-router';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';

import { BrandBackground } from '@/components/BrandBackground';
import { BrandWordmark } from '@/components/BrandWordmark';
import { OnboardingAnimatedBlock } from '@/components/OnboardingAnimatedBlock';
import { useI18n } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <View className="flex-1 px-gutter pb-12 z-10">
        <OnboardingAnimatedBlock className="flex-1 items-center justify-center">
          <View className="mb-10 items-center justify-center">
            <BrandWordmark width={220} tone="deep" />
          </View>

          <Text className="mt-4 text-center font-display text-[40px] leading-[44px] text-ink-dark tracking-[-0.5px]">
            {t('onboarding.welcomeTitle')}
          </Text>

          <Text className="mt-6 text-center max-w-[320px] font-sans text-[17px] leading-[28px] text-ink-dark/60">
            {t('onboarding.welcomeDescription')}
          </Text>
        </OnboardingAnimatedBlock>

        {/* Bottom CTA */}
        <View className="w-full mt-auto">
          <TouchableOpacity
            className="w-full items-center justify-center rounded-[24px] bg-brand-accent-deep py-5 shadow-sm active:opacity-80 transition-opacity"
            onPress={() => router.push('/onboarding/style')}
          >
            <Text className="font-sans text-[17px] font-semibold tracking-wide text-base-canvas">
              {t('onboarding.start')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
