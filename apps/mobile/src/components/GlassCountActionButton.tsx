import { Ionicons } from '@expo/vector-icons'
import { memo } from 'react'
import { Text, TouchableOpacity, ViewStyle } from 'react-native'

import { colors, shadows } from '@/design/tokens'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  count?: number
  active?: boolean
  disabled?: boolean
  accessibilityLabel: string
  tone?: 'light' | 'dark'
}

function formatCount(value?: number) {
  if (value == null) return null
  if (value < 1000) return String(value)
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
}

const lightBase: ViewStyle = {
  width: 58,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.24)',
  backgroundColor: 'rgba(255,255,255,0.16)',
}

const lightActive: ViewStyle = {
  backgroundColor: 'rgba(255,255,255,0.26)',
}

const darkBase: ViewStyle = {
  width: 58,
  borderRadius: 22,
  borderWidth: 0,
  borderColor: 'transparent',
  backgroundColor: 'transparent',
}

const darkActive: ViewStyle = {
  backgroundColor: 'rgba(43,42,43,0.08)',
}

export const GlassCountActionButton = memo(function GlassCountActionButton({
  icon,
  onPress,
  count,
  active = false,
  disabled = false,
  accessibilityLabel,
  tone = 'light',
}: Props) {
  const countLabel = formatCount(count)
  const isDark = tone === 'dark'
  const iconColor = isDark ? colors.inkDark : colors.baseCanvas

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.84}
      className="items-center px-2 py-3"
      style={[
        isDark ? darkBase : lightBase,
        isDark ? null : shadows.glass,
        active ? (isDark ? darkActive : lightActive) : null,
        disabled ? { opacity: 0.4 } : null,
      ]}
    >
      <Ionicons name={icon} size={26} color={iconColor} />
      {countLabel ? (
        <Text
          className="mt-1 font-sans text-xs font-semibold"
          style={{ color: isDark ? colors.inkDark : colors.baseCanvas }}
        >
          {countLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
})
