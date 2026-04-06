import { ImageSourcePropType, ViewStyle } from 'react-native'

export type SupportedLocale = 'sr' | 'en' | 'ru'

export const colors = {
  accentDeep: '#431A43',
  accentLight: '#9DD3E4',
  highlight: '#CBDA63',
  baseCanvas: '#F6F8ED',
  inkDark: '#2B2A2B',
  panel: '#FFFCF6',
  soft: '#EEF4E5',
  tint: '#EEE7EE',
  surfaceWhite: 'rgba(255,252,246,0.92)',
  glassLight: 'rgba(246,248,237,0.72)',
  glassDark: 'rgba(67,26,67,0.68)',
  glassBorder: 'rgba(246,248,237,0.22)',
  mutedBorder: 'rgba(43,42,43,0.08)',
  mutedText: 'rgba(43,42,43,0.56)',
  mutedTextStrong: 'rgba(43,42,43,0.72)',
  overlay: 'rgba(16,8,16,0.26)',
  overlayStrong: 'rgba(16,8,16,0.52)',
  danger: '#C53B59',
} as const

export const fonts = {
  logo: 'Ballet',
  display: 'AlteHaasGrotesk-Bold',
  sans: 'Inter',
} as const

export const localeTags: Record<SupportedLocale, string> = {
  sr: 'sr-Latn-RS',
  en: 'en-US',
  ru: 'ru-RU',
}

export const radii = {
  pill: 999,
  soft: 24,
  card: 30,
  editorial: 38,
} as const

export const shadows = {
  soft: {
    shadowColor: colors.inkDark,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  } satisfies ViewStyle,
  glass: {
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  } satisfies ViewStyle,
  floating: {
    shadowColor: colors.inkDark,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  } satisfies ViewStyle,
} as const

export const assets = {
  wordmark: require('../../assets/brand/velve-wordmark.png') as ImageSourcePropType,
}

export function detectLocaleFromDevice(): SupportedLocale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()

  if (locale.startsWith('sr')) return 'sr'
  if (locale.startsWith('ru')) return 'ru'
  return 'en'
}
