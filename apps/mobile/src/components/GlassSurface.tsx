import { ReactNode } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'

import { shadows } from '@/design/tokens'

type Props = {
  children: ReactNode
  className?: string
  style?: StyleProp<ViewStyle>
  dark?: boolean
}

export function GlassSurface({ children, className = '', style, dark = false }: Props) {
  const palette = dark
    ? 'border-base-canvas/15 bg-brand-accent-deep/70'
    : 'border-base-canvas/60 bg-base-canvas/70'

  return (
    <View
      className={`overflow-hidden rounded-card border ${palette} ${className}`}
      style={[shadows.glass, style]}
    >
      {children}
    </View>
  )
}
