import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'

import { BrandedLoader } from '@/components/BrandedLoader'

export default function DetailsRedirectScreen() {
  const router = useRouter()
  const { itemId } = useLocalSearchParams<{ itemId: string }>()

  useEffect(() => {
    if (itemId) {
      router.replace({
        pathname: '/upload-flow/category',
        params: { itemId },
      })
    } else {
      router.replace('/upload-flow')
    }
  }, [itemId, router])

  return <BrandedLoader />
}
