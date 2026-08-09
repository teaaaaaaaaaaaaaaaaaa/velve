import { ActivityIndicator, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { colors } from '@/design/tokens';

type LoaderProps = {
  label?: string;
  dark?: boolean;
  showSpinner?: boolean;
};

export function BrandedLoader({ label, dark = false, showSpinner = false }: LoaderProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-panel px-8">
      <BrandWordmark width={168} tone={dark ? 'deep' : 'deep'} />
      <Text className="mt-5 text-center font-sans text-sm text-ink-dark/58">
        {label || 'Peglamo piksele i trazimo najbolji komad...'}
      </Text>
      {showSpinner ? (
        <ActivityIndicator size="large" color={colors.accentDeep} style={{ marginTop: 24 }} />
      ) : null}
    </View>
  );
}

export function FeedSkeleton() {
  return <BrandedLoader showSpinner />;
}

export function ProfileSkeleton() {
  return <BrandedLoader showSpinner />;
}

export function ChatSkeleton() {
  return <BrandedLoader showSpinner />;
}
