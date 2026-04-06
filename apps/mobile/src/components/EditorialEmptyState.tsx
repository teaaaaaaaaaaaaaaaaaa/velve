import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import { TouchableOpacity, View, Text } from 'react-native'

import { BrandWordmark } from '@/components/BrandWordmark'
import { GlassSurface } from '@/components/GlassSurface'
import { colors } from '@/design/tokens'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  footer?: ReactNode
}

export function EditorialEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  footer,
}: Props) {
  return (
    <GlassSurface className="items-center justify-center px-6 py-10">
      <View className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-brand-accent-light/25" />
      <View className="absolute -right-12 bottom-0 h-36 w-36 rounded-full bg-brand-highlight/15" />
      <View className="absolute left-12 top-10 h-14 w-14 rounded-full bg-brand-accent-deep/8" />

      <BrandWordmark width={120} />

      <View className="mb-5 mt-4 h-16 w-16 items-center justify-center rounded-full bg-brand-accent-deep/8">
        <Ionicons name={icon} size={30} color={colors.accentDeep} />
      </View>

      <Text className="mb-2 text-center font-display text-2xl text-ink-dark">
        {title}
      </Text>
      <Text className="mb-6 text-center font-sans text-sm leading-6 text-ink-dark/65">
        {description}
      </Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          className="rounded-full bg-brand-accent-deep px-6 py-3"
          activeOpacity={0.85}
          onPress={onAction}
        >
          <Text className="font-sans text-sm font-semibold text-base-canvas">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}

      {footer ? <View className="mt-4">{footer}</View> : null}
    </GlassSurface>
  )
}
