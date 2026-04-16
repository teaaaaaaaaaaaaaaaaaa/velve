import { ActivityIndicator, View } from 'react-native'

import { BrandWordmark } from '@/components/BrandWordmark'
import { colors } from '@/design/tokens'

type LoaderProps = {
  label?: string
  dark?: boolean
  showSpinner?: boolean
}

export function BrandedLoader({ dark = false, showSpinner = false }: LoaderProps) {
  return (
    <View
      className={`flex-1 items-center justify-center ${
        dark ? 'bg-brand-accent-deep' : 'bg-base-canvas'
      }`}
    >
      <BrandWordmark width={168} tone={dark ? 'light' : 'deep'} />
      {showSpinner ? (
        <ActivityIndicator
          size="large"
          color={dark ? colors.baseCanvas : colors.accentDeep}
          style={{ marginTop: 32 }}
        />
      ) : null}
    </View>
  )
}

export function FeedSkeleton() {
  return <BrandedLoader dark />
}

export function ProfileSkeleton() {
  return <BrandedLoader showSpinner />
}

export function ChatSkeleton() {
  return <BrandedLoader showSpinner />
}
