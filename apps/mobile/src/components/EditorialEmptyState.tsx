import { Ionicons } from '@expo/vector-icons'
import { memo, ReactNode } from 'react'
import { TouchableOpacity, View, Text } from 'react-native'

import { BrandWordmark } from '@/components/BrandWordmark'
import { colors } from '@/design/tokens'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  footer?: ReactNode
}

export const EditorialEmptyState = memo(function EditorialEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  footer,
}: Props) {
  return (
    <View className="items-center justify-center px-6 py-10">
      <BrandWordmark width={120} />

      <View className="mb-5 mt-6 h-14 w-14 items-center justify-center rounded-2xl bg-surface-tint">
        <Ionicons name={icon} size={26} color={colors.accentDeep} />
      </View>

      <Text className="mb-2 text-center font-display text-2xl text-ink-dark">
        {title}
      </Text>
      <Text className="mb-6 text-center font-sans text-sm leading-6 text-ink-dark/60">
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
    </View>
  )
})
