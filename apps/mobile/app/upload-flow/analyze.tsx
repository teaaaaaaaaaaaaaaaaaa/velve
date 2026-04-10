import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { analyzeLocalImage } from '@/lib/imageRequests'

type AnalysisPayload = {
  ready: boolean
  messages: string[]
  checks: {
    lighting: { ok: boolean }
    framing: { ok: boolean }
    contrast: { ok: boolean }
  }
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View className="flex-row items-center justify-between rounded-[22px] bg-surface-panel px-4 py-4">
      <Text className="font-sans text-sm text-ink-dark">{label}</Text>
      <View className={`rounded-full px-3 py-1.5 ${ok ? 'bg-brand-highlight' : 'bg-brand-accent-light/35'}`}>
        <Text className="font-sans text-xs font-semibold text-ink-dark">
          {ok ? 'OK' : 'Podesi'}
        </Text>
      </View>
    </View>
  )
}

export default function CleanCutAnalyzeScreen() {
  const router = useRouter()
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const scan = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [scan])

  useEffect(() => {
    if (!imageUri) {
      router.replace('/upload-flow')
      return
    }

    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const payload = await analyzeLocalImage(imageUri, '/api/ai/analyze-garment-photo')
        if (active) {
          setAnalysis(payload)
        }
      } catch (error) {
        Alert.alert('AI analiza nije dostupna', 'Ne mogu da analiziram ovu sliku sada.', [
          { text: 'Nazad', onPress: () => router.replace('/upload-flow') },
        ])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [imageUri, router])

  const scanTranslate = useMemo(
    () =>
      scan.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, 150],
      }),
    [scan]
  )

  return (
    <View className="flex-1 bg-base-canvas px-5 pb-8 pt-14">
      <TouchableOpacity
        onPress={() => router.back()}
        className="mb-5 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
      >
        <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
      </TouchableOpacity>

      <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
        AI analiza
      </Text>
      <Text className="mt-2 font-display text-4xl text-ink-dark">
        Real-time feedback
      </Text>

      <View className="mt-6 overflow-hidden rounded-[34px] bg-brand-accent-deep">
        <RemoteImage
          uri={imageUri}
          className="h-[360px] w-full"
        />
        <Animated.View
          style={{
            transform: [{ translateY: scanTranslate }],
            opacity: 0.8,
          }}
          className="absolute left-0 right-0 top-24 h-16 bg-brand-accent-light/55"
        />
      </View>

      <View className="mt-6 gap-3">
        <CheckRow label="Svetlo" ok={!!analysis?.checks?.lighting?.ok} />
        <CheckRow label="Kadar" ok={!!analysis?.checks?.framing?.ok} />
        <CheckRow label="Kontrast" ok={!!analysis?.checks?.contrast?.ok} />
      </View>

      <View className="mt-5 rounded-[24px] bg-surface-panel px-4 py-4">
        {loading ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color={colors.accentDeep} />
            <Text className="ml-3 font-sans text-sm text-ink-dark/65">
              Velve proverava svetlo, kadar i kontrast...
            </Text>
          </View>
        ) : analysis?.messages?.length ? (
          analysis.messages.map((message) => (
            <Text key={message} className="mb-2 font-sans text-sm leading-6 text-ink-dark/70">
              {message}
            </Text>
          ))
        ) : (
          <Text className="font-sans text-sm leading-6 text-ink-dark/70">
            Sve izgleda dobro. Mozemo da generisemo digitalni artikal.
          </Text>
        )}
      </View>

      <TouchableOpacity
        disabled={!analysis?.ready || loading}
        onPress={() =>
          router.push({
            pathname: '/upload-flow/transform',
            params: { imageUri },
          })
        }
        className={`mt-auto items-center rounded-full px-4 py-4 ${
          analysis?.ready && !loading ? 'bg-brand-accent-deep' : 'bg-brand-accent-deep/25'
        }`}
      >
        <Text className={`font-sans text-base font-semibold ${analysis?.ready && !loading ? 'text-base-canvas' : 'text-ink-dark/45'}`}>
          Generisi digitalni artikal
        </Text>
      </TouchableOpacity>
    </View>
  )
}
