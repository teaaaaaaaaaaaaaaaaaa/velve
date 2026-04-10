import { Ionicons } from '@expo/vector-icons'
import { memo } from 'react'
import { Text, TouchableOpacity, ViewStyle } from 'react-native'

import { colors, shadows } from '@/design/tokens'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  count?: number
  active?: boolean
  accessibilityLabel: string
}

function formatCount(value?: number) {
  if (value == null) return null
  if (value < 1000) return String(value)
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
}

const baseStyle: ViewStyle = {
  width: 58,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.24)',
  backgroundColor: 'rgba(255,255,255,0.16)',
}

const activeStyle: ViewStyle = {
  backgroundColor: 'rgba(255,255,255,0.26)',
}

export const GlassCountActionButton = memo(function GlassCountActionButton({
  icon,
  onPress,
  count,
  active = false,
  accessibilityLabel,
}: Props) {
  const countLabel = formatCount(count)

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={0.84}
      className="items-center px-2 py-3"
      style={[baseStyle, shadows.glass, active ? activeStyle : null]}
    >
      <Ionicons name={icon} size={26} color={colors.baseCanvas} />
      {countLabel ? (
        <Text className="mt-1 font-sans text-xs font-semibold text-base-canvas">{countLabel}</Text>
      ) : null}
    </TouchableOpacity>
  )
})
