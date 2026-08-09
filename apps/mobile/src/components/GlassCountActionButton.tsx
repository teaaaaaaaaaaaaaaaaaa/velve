import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity } from 'react-native';

import { colors } from '@/design/tokens';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  tone?: 'light' | 'dark';
  /** Icon color when `active` — e.g. red for the like heart. Defaults to the base icon color. */
  activeColor?: string;
};

function formatCount(value?: number) {
  if (value == null) return null;
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
}

export const GlassCountActionButton = memo(function GlassCountActionButton({
  icon,
  onPress,
  count,
  active = false,
  disabled = false,
  accessibilityLabel,
  tone = 'light',
  activeColor,
}: Props) {
  const countLabel = formatCount(count);
  const isDark = tone === 'dark';
  const baseColor = isDark ? colors.inkDark : colors.baseCanvas;
  const iconColor = active && activeColor ? activeColor : baseColor;

  // Instagram-style pop when the action toggles on.
  const popScale = useRef(new Animated.Value(1)).current;
  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      popScale.setValue(0.6);
      Animated.spring(popScale, {
        toValue: 1,
        friction: 3,
        tension: 240,
        useNativeDriver: true,
      }).start();
    }
    wasActiveRef.current = active;
  }, [active, popScale]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
      className="w-[58px] items-center px-2 py-2"
      style={disabled ? { opacity: 0.4 } : null}
    >
      <Animated.View style={{ transform: [{ scale: popScale }] }}>
        <Ionicons name={icon} size={27} color={iconColor} />
      </Animated.View>
      {countLabel ? (
        <Text className="mt-1 font-sans text-xs font-semibold" style={{ color: baseColor }}>
          {countLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});
