import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { colors } from '@/design/tokens';

export type VelveTextInputRef = TextInput;

type VelveTextInputProps = TextInputProps & {
  className?: string;
};

export const VelveTextInput = forwardRef<VelveTextInputRef, VelveTextInputProps>(
  function VelveTextInput(
    {
      className,
      placeholderTextColor = colors.mutedText,
      selectionColor = colors.accentDeep,
      ...props
    },
    ref
  ) {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor}
        selectionColor={selectionColor}
        className={className}
        {...props}
      />
    );
  }
);
