import { ReactNode } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

type OnboardingAnimatedBlockProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function OnboardingAnimatedBlock({
  children,
  delay = 0,
  className,
}: OnboardingAnimatedBlockProps) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(420)} className={className}>
      {children}
    </Animated.View>
  );
}
