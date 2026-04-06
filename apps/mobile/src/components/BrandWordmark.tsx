import { Image, ImageStyle, StyleProp } from 'react-native'

import { assets, colors } from '@/design/tokens'

type Props = {
  width?: number
  tone?: 'deep' | 'light'
  style?: StyleProp<ImageStyle>
}

const WORDMARK_RATIO = 1252 / 677

export function BrandWordmark({ width = 180, tone = 'deep', style }: Props) {
  return (
    <Image
      source={assets.wordmark}
      resizeMode="contain"
      style={[
        {
          width,
          height: width / WORDMARK_RATIO,
          tintColor: tone === 'light' ? colors.baseCanvas : colors.accentDeep,
        },
        style,
      ]}
    />
  )
}
