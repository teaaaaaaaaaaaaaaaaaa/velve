import { KeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardAwareScreenProps = KeyboardAvoidingViewProps & {
  className?: string;
  offset?: number;
};

export function KeyboardAwareScreen({
  children,
  className,
  offset,
  behavior,
  keyboardVerticalOffset,
  style,
  ...props
}: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const resolvedOffset =
    keyboardVerticalOffset ?? offset ?? (Platform.OS === 'ios' ? insets.top : 0);

  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)}
      keyboardVerticalOffset={resolvedOffset}
      className={className ? `flex-1 ${className}` : 'flex-1'}
      style={[{ flex: 1 }, style]}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
