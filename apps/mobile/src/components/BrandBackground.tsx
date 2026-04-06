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
      <View
        className={`absolute -left-12 -top-10 h-52 w-52 rounded-full ${
          dark ? 'bg-brand-accent-light/12' : 'bg-brand-accent-light/28'
        }`}
      />
      <View
        className={`absolute right-[-28px] top-28 h-44 w-44 rounded-full ${
          dark ? 'bg-brand-highlight/10' : 'bg-brand-highlight/22'
        }`}
      />
      <View
        className={`absolute bottom-[-36px] left-16 h-56 w-56 rounded-full ${
          dark ? 'bg-base-canvas/8' : 'bg-brand-accent-deep/8'
        }`}
      />
      <View
        className={`absolute bottom-36 right-10 h-24 w-24 rounded-full ${
          dark ? 'bg-brand-accent-light/10' : 'bg-brand-accent-deep/6'
        }`}
      />
      {children}
    </View>
  )
}
