import { Image, ImageStyle, StyleProp } from 'react-native'

import { assets, colors } from '@/design/tokens'

type Props = {
  width?: number
  tone?: 'deep' | 'light' | 'dark'
  style?: StyleProp<ImageStyle>
}

const WORDMARK_RATIO = 1252 / 677

const toneColors: Record<NonNullable<Props['tone']>, string> = {
  deep: colors.accentDeep,
  light: colors.baseCanvas,
  dark: colors.inkDark,
}

export function BrandWordmark({ width = 180, tone = 'deep', style }: Props) {
  return (
    <Image
      source={assets.wordmark}
      resizeMode="contain"
      style={[
        {
          width,
          height: width / WORDMARK_RATIO,
          tintColor: toneColors[tone],
        },
        style,
      ]}
    />
  )
}
