import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

type Props = {
  dark?: boolean
  children?: ReactNode
}

export function BrandBackground({ dark = false, children }: Props) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View
        className={`absolute inset-0 ${dark ? 'bg-brand-accent-deep' : 'bg-base-canvas'}`}
      />
      {children}
    </View>
  )
}
