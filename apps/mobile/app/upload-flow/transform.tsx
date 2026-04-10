import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Alert } from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { uploadImageUri } from '@/lib/imageRequests'

export default function CleanCutTransformScreen() {
  const router = useRouter()
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()

  useEffect(() => {
    if (!imageUri) {
      router.replace('/upload-flow')
      return
    }

    let active = true
    ;(async () => {
      try {
        const uploadResult = await uploadImageUri(imageUri)

        const createResponse = await client.post('/api/items', {
          status: 'draft',
          images: [uploadResult.url],
          condition: 'good',
          category: 'Unsorted',
          title: 'Untitled draft',
          listingType: 'trade',
        })

        const itemId = createResponse.data?.data?._id
        if (!itemId) {
          throw new Error('Draft item was not created')
        }

        await client.post(`/api/items/${itemId}/digitize`)

        if (active) {
          router.replace({
            pathname: '/upload-flow/review',
            params: { itemId },
          })
        }
      } catch (error: any) {
        if (!active) return
        Alert.alert(
          'Transformacija nije uspela',
          error?.response?.data?.error ||
            error?.message ||
            'Pokusaj ponovo za nekoliko trenutaka.',
          [{ text: 'Nazad', onPress: () => router.replace('/upload-flow') }]
        )
      }
    })()

    return () => {
      active = false
    }
  }, [imageUri, router])

  return <BrandedLoader />
}
