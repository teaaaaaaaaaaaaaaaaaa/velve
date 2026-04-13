import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Animated, Easing, Text, View } from 'react-native'

import client from '@/api/client'
import { BrandWordmark } from '@/components/BrandWordmark'
import { BrandBackground } from '@/components/BrandBackground'
import { uploadImageUri } from '@/lib/imageRequests'

const STEPS = [
  'Pripremamo tvoju sliku...',
  'Uklanjamo pozadinu...',
  'Digitalizujemo komad...',
  'Uploadujemo na cloud...',
  'Generisemo AI embedding...',
  'Zavrsavamo...',
]

function useStepCycler(steps: string[], intervalMs = 3200) {
  const [index, setIndex] = useState(0)
  const fade = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % steps.length)
        Animated.timing(fade, {
          toValue: 1,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start()
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [fade, intervalMs, steps.length])

  return { text: steps[index], opacity: fade }
}

function usePulse() {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(0.85)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.06,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.85,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [scale, opacity])

  return { scale, opacity }
}

export default function CleanCutTransformScreen() {
  const router = useRouter()
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()
  const step = useStepCycler(STEPS)
  const pulse = usePulse()

  const doTransform = useCallback(async () => {
    if (!imageUri) {
      router.replace('/upload-flow')
      return
    }

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

    await client.post(`/api/items/${itemId}/digitize`, {}, { timeout: 120000 })

    return itemId
  }, [imageUri, router])

  useEffect(() => {
    let active = true

    doTransform()
      .then((itemId) => {
        if (active && itemId) {
          router.replace({
            pathname: '/upload-flow/review',
            params: { itemId },
          })
        }
      })
      .catch((error: any) => {
        if (!active) return
        Alert.alert(
          'Transformacija nije uspela',
          error?.response?.data?.error ||
            error?.message ||
            'Pokusaj ponovo za nekoliko trenutaka.',
          [{ text: 'Nazad', onPress: () => router.replace('/upload-flow') }]
        )
      })

    return () => {
      active = false
    }
  }, [doTransform, router])

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <BrandBackground />

      <Animated.View
        style={{ transform: [{ scale: pulse.scale }], opacity: pulse.opacity }}
      >
        <BrandWordmark width={180} />
      </Animated.View>

      <Animated.View style={{ opacity: step.opacity, marginTop: 32 }}>
        <Text className="text-center font-sans text-base tracking-wide text-ink-dark/60">
          {step.text}
        </Text>
      </Animated.View>
    </View>
  )
}
