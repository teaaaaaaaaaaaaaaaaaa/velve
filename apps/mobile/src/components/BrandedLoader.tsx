import { View } from 'react-native'

import { BrandWordmark } from '@/components/BrandWordmark'

type LoaderProps = {
  label?: string
  dark?: boolean
}

export function BrandedLoader({ dark = false }: LoaderProps) {
  return (
    <View
      className={`flex-1 items-center justify-center ${
        dark ? 'bg-brand-accent-deep' : 'bg-base-canvas'
      }`}
    >
      <BrandWordmark width={168} tone={dark ? 'light' : 'deep'} />
    </View>
  )
}

export function FeedSkeleton() {
  return <BrandedLoader dark />
}

export function ProfileSkeleton() {
  return <BrandedLoader />
}

export function ChatSkeleton() {
  return <BrandedLoader />
}
