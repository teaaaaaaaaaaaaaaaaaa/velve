import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

import { BrandBackground } from '@/components/BrandBackground';
import { BrandWordmark } from '@/components/BrandWordmark';
import { GlassSurface } from '@/components/GlassSurface';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';

const COPY = {
  sr: {
    mood: 'pre nego sto krenemo',
    title: 'Prihvati uslove koriscenja da bi nastavio.',
    description:
      'Velve je zajednica izgrađena na poverenju. Pre nego sto krenes, upoznaj se sa pravilima.',
    tosLabel: 'Uslovi koriscenja',
    tosDescription: 'Kako funkcionise razmena, prava i obaveze korisnika, i pravila zajednice.',
    privacyLabel: 'Politika privatnosti',
    privacyDescription: 'Kako cuvamo tvoje podatke, slike i preferencije.',
    accept: 'Prihvatam i nastavljam',
    checkboxLabel: 'Procitao/la sam i prihvatam uslove koriscenja i politiku privatnosti.',
  },
  en: {
    mood: 'before we begin',
    title: 'Accept the terms of use to continue.',
    description:
      'Velve is a community built on trust. Before you start, get familiar with the rules.',
    tosLabel: 'Terms of Use',
    tosDescription: 'How trading works, user rights and obligations, and community rules.',
    privacyLabel: 'Privacy Policy',
    privacyDescription: 'How we store your data, images, and preferences.',
    accept: 'I accept and continue',
    checkboxLabel: 'I have read and accept the terms of use and privacy policy.',
  },
  ru: {
    mood: 'прежде чем начнём',
    title: 'Прими условия использования, чтобы продолжить.',
    description:
      'Velve — сообщество, построенное на доверии. Перед началом ознакомься с правилами.',
    tosLabel: 'Условия использования',
    tosDescription: 'Как работает обмен, права и обязанности пользователей, правила сообщества.',
    privacyLabel: 'Политика конфиденциальности',
    privacyDescription: 'Как мы храним твои данные, изображения и предпочтения.',
    accept: 'Принимаю и продолжаю',
    checkboxLabel: 'Я прочитал(а) и принимаю условия использования и политику конфиденциальности.',
  },
} as const;

export default function TermsScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const [accepted, setAccepted] = useState(false);

  const copy = COPY[locale];

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <ScrollView
        className="flex-1 px-gutter"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 70 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-start">
          <BrandWordmark width={180} tone="deep" />
          <Text className="mt-5 font-logo text-[30px] leading-none text-brand-accent-deep/72">
            {copy.mood}
          </Text>
          <Text className="mt-4 font-display text-[38px] leading-[40px] text-ink-dark">
            {copy.title}
          </Text>
          <Text className="mt-4 max-w-[344px] font-sans text-base leading-7 text-ink-dark/68">
            {copy.description}
          </Text>
        </View>

        <GlassSurface className="mt-8 px-5 py-5">
          <TouchableOpacity
            className="flex-row items-start"
            onPress={() => Linking.openURL('https://velve.app/terms')}
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/28">
              <Ionicons name="document-text-outline" size={22} color={colors.accentDeep} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-[22px] text-ink-dark">{copy.tosLabel}</Text>
              <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
                {copy.tosDescription}
              </Text>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color={colors.accentDeep}
              style={{ marginTop: 4 }}
            />
          </TouchableOpacity>
        </GlassSurface>

        <GlassSurface className="mt-4 px-5 py-5">
          <TouchableOpacity
            className="flex-row items-start"
            onPress={() => Linking.openURL('https://velve.app/privacy')}
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/28">
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.accentDeep} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-[22px] text-ink-dark">{copy.privacyLabel}</Text>
              <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
                {copy.privacyDescription}
              </Text>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color={colors.accentDeep}
              style={{ marginTop: 4 }}
            />
          </TouchableOpacity>
        </GlassSurface>

        <TouchableOpacity
          className="mt-6 flex-row items-center"
          onPress={() => setAccepted(!accepted)}
        >
          <View
            className={`h-7 w-7 items-center justify-center rounded-lg border-2 ${
              accepted
                ? 'border-brand-accent-deep bg-brand-accent-deep'
                : 'border-ink-dark/20 bg-base-canvas'
            }`}
          >
            {accepted ? <Ionicons name="checkmark" size={18} color={colors.baseCanvas} /> : null}
          </View>
          <Text className="ml-3 flex-1 font-sans text-sm leading-6 text-ink-dark/72">
            {copy.checkboxLabel}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View className="px-gutter pb-10 pt-4">
        <TouchableOpacity
          onPress={() => router.push('/onboarding/welcome')}
          disabled={!accepted}
          className={`items-center rounded-pill px-5 py-4 ${
            accepted ? 'bg-brand-accent-deep' : 'bg-ink-dark/16'
          }`}
        >
          <Text
            className={`font-sans text-base font-semibold ${
              accepted ? 'text-base-canvas' : 'text-ink-dark/42'
            }`}
          >
            {copy.accept}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
