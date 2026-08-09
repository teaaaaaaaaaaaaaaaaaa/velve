import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/design/tokens';

type OnboardingProgressHeaderProps = {
  stepLabel: string;
  progress: number;
  unlockLabel: string;
  onBack?: () => void;
};

export function OnboardingProgressHeader({
  stepLabel,
  progress,
  unlockLabel,
  onBack,
}: OnboardingProgressHeaderProps) {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(Math.min(Math.max(progress, 0), 1), { duration: 520 });
  }, [progress, progressValue]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(progressValue.value * 100, 6)}%`,
  }));

  return (
    <View className="px-gutter pb-4 pt-14">
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-base-canvas/82"
        >
          <Ionicons name="arrow-back" size={20} color={colors.accentDeep} />
        </TouchableOpacity>
      ) : null}

      <Animated.View
        entering={FadeInDown.duration(360)}
        className="self-start rounded-pill bg-brand-accent-deep/8 px-4 py-2"
      >
        <Text className="font-sans text-xs uppercase tracking-[1.2px] text-brand-accent-deep">
          {stepLabel}
        </Text>
      </Animated.View>

      <View className="mt-4 h-2 overflow-hidden rounded-full bg-ink-dark/8">
        <Animated.View className="h-full rounded-full bg-brand-accent-deep" style={progressStyle} />
      </View>

      <Animated.View
        entering={FadeInRight.delay(130).duration(360)}
        className="mt-3 flex-row items-center self-start rounded-pill bg-brand-highlight/35 px-3 py-2"
      >
        <Ionicons name="sparkles-outline" size={13} color={colors.inkDark} />
        <Text className="ml-1.5 font-sans text-xs font-semibold text-ink-dark">{unlockLabel}</Text>
      </Animated.View>
    </View>
  );
}
