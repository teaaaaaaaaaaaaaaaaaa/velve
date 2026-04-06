import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { colors } from '@/design/tokens'

type LoaderProps = {
  label: string
  dark?: boolean
}

export function BrandedLoader({ label, dark = false }: LoaderProps) {
  const pulse = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    )

    animation.start()

    return () => animation.stop()
  }, [pulse])

  return (
    <View
      className={`flex-1 items-center justify-center ${
        dark ? 'bg-brand-accent-deep' : 'bg-base-canvas'
      }`}
    >
      <BrandBackground dark={dark} />
      <BrandWordmark width={210} tone={dark ? 'light' : 'deep'} />
      <Text
        className={`mt-5 font-sans text-sm tracking-[0.4px] ${
          dark ? 'text-base-canvas/70' : 'text-ink-dark/60'
        }`}
      >
        {label}
      </Text>
      <View className="mt-8 w-[180px] gap-2">
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={{
              opacity: pulse,
              backgroundColor: dark ? 'rgba(246,248,237,0.16)' : 'rgba(67,26,67,0.12)',
            }}
            className={`h-2 rounded-full ${index === 1 ? 'mx-4' : ''}`}
          />
        ))}
      </View>
      <View
        className="mt-6 rounded-pill px-4 py-2"
        style={{
          backgroundColor: dark ? 'rgba(246,248,237,0.12)' : 'rgba(67,26,67,0.08)',
          borderWidth: 1,
          borderColor: dark ? 'rgba(246,248,237,0.14)' : 'rgba(67,26,67,0.08)',
        }}
      >
        <Text
          className="font-logo text-2xl"
          style={{ color: dark ? colors.baseCanvas : colors.accentDeep }}
        >
          curated
        </Text>
      </View>
    </View>
  )
}

function SkeletonPulse({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 850, useNativeDriver: true }),
      ])
    )

    animation.start()
    return () => animation.stop()
  }, [opacity])

  return <Animated.View style={{ opacity }}>{children}</Animated.View>
}

export function FeedSkeleton() {
  return (
    <View className="flex-1 bg-brand-accent-deep">
      <BrandBackground dark />
      <SkeletonPulse>
        <View className="absolute left-5 right-5 top-16 flex-row items-center justify-between">
          <View className="w-[160px] gap-3">
            <View className="h-3 rounded-full bg-base-canvas/20" />
            <View className="h-9 rounded-full bg-base-canvas/28" />
          </View>
          <View className="h-12 w-28 rounded-full bg-base-canvas/16" />
        </View>
        <View className="absolute inset-x-0 bottom-0 top-0 bg-base-canvas/6" />
        <View className="absolute bottom-36 left-4 right-20 h-36 rounded-editorial bg-brand-accent-deep/36" />
        <View className="absolute bottom-56 right-4 h-56 w-14 rounded-card bg-base-canvas/10" />
      </SkeletonPulse>
    </View>
  )
}

export function ProfileSkeleton() {
  return (
    <View className="flex-1 bg-base-canvas px-gutter pt-14">
      <BrandBackground />
      <SkeletonPulse>
        <View className="rounded-editorial border border-ink-dark/8 bg-surface-panel px-5 pb-6 pt-6">
          <View className="h-24 w-24 rounded-full bg-brand-accent-light/35" />
          <View className="mt-5 h-10 w-2/3 rounded-full bg-brand-accent-deep/12" />
          <View className="mt-3 h-4 w-1/2 rounded-full bg-ink-dark/10" />
          <View className="mt-6 h-16 rounded-soft bg-ink-dark/6" />
        </View>
        <View className="mt-6 flex-row flex-wrap justify-between">
          {[0, 1, 2, 3].map((index) => (
            <View key={index} className="mb-3 h-36 w-[48%] rounded-soft bg-surface-panel" />
          ))}
        </View>
      </SkeletonPulse>
    </View>
  )
}

export function ChatSkeleton() {
  return (
    <View className="flex-1 bg-base-canvas px-gutter pt-16">
      <BrandBackground />
      <SkeletonPulse>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            className="mb-4 flex-row items-center rounded-soft bg-surface-panel px-4 py-4"
          >
            <View className="h-14 w-14 rounded-full bg-brand-accent-light/35" />
            <View className="ml-4 flex-1 gap-3">
              <View className="h-6 w-1/2 rounded-full bg-brand-accent-deep/10" />
              <View className="h-4 w-4/5 rounded-full bg-ink-dark/10" />
            </View>
          </View>
        ))}
      </SkeletonPulse>
    </View>
  )
}
