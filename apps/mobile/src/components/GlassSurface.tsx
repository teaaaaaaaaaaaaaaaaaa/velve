import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { colors } from '@/design/tokens';

type Props = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
};

export function GlassSurface({ children, className = '', style, dark = false }: Props) {
  const palette = dark
    ? 'border-base-canvas/10 bg-brand-accent-deep'
    : 'border-ink-dark/6 bg-surface-panel';

  const shadow: ViewStyle = dark
    ? {
        shadowColor: colors.accentDeep,
        shadowOpacity: 0.22,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }
    : {
        shadowColor: colors.inkDark,
        shadowOpacity: 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      };

  return (
    <View
      className={`overflow-hidden rounded-card border ${palette} ${className}`}
      style={[shadow, style]}
    >
      {children}
    </View>
  );
}
