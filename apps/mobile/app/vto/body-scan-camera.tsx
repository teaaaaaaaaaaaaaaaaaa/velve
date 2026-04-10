import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native'

import { BrandedLoader } from '@/components/BrandedLoader'
import { analyzeLocalImage, uploadBodyScanUri } from '@/lib/imageRequests'

let CameraView: any = null
let useCameraPermissions: any = null
try {
  const mod = require('expo-camera')
  CameraView = mod.CameraView
  useCameraPermissions = mod.useCameraPermissions
} catch {
  // Native module not available in this build
}

type AnalysisState = {
  ready: boolean
  message: string
}

export default function BodyScanCameraScreen() {
  if (!CameraView || !useCameraPermissions) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas px-5">
        <Text className="text-center font-sans text-base leading-6 text-ink-dark/65">
          Kamera nije dostupna u ovom buildu. Pokreni "npx expo prebuild" pa ponovo builduj aplikaciju.
        </Text>
      </View>
    )
  }

  return <BodyScanCameraInner />
}

function BodyScanCameraInner() {
  const router = useRouter()
  const cameraRef = useRef<any>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [analysis, setAnalysis] = useState<AnalysisState>({
    ready: false,
    message: 'Nisi u silueti ili pozadina nije cista bela.',
  })
  const [stableReadyCount, setStableReadyCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [permission?.granted, requestPermission])

  useEffect(() => {
    if (!permission?.granted || !cameraRef.current || busy) {
      return
    }

    let cancelled = false
    const interval = setInterval(async () => {
      if (cancelled || busy || !cameraRef.current) return

      try {
        setBusy(true)
        const snapshot = await cameraRef.current.takePictureAsync({
          quality: 0.35,
          skipProcessing: true,
        })

        if (!snapshot?.uri || cancelled) return
        const payload = await analyzeLocalImage(snapshot.uri, '/api/ai/analyze-body-scan')
        if (cancelled) return

        setAnalysis({
          ready: !!payload?.ready,
          message: payload?.message || 'Nisi u silueti ili pozadina nije cista bela.',
        })
        setStableReadyCount((prev) => (payload?.ready ? Math.min(prev + 1, 3) : 0))
      } catch {
        if (!cancelled) {
          setStableReadyCount(0)
          setAnalysis({
            ready: false,
            message: 'Nisi u silueti ili pozadina nije cista bela.',
          })
        }
      } finally {
        if (!cancelled) {
          setBusy(false)
        }
      }
    }, 1700)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [busy, permission?.granted])

  async function captureFinal() {
    if (!cameraRef.current) return
    try {
      setBusy(true)
      const finalPhoto = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      })

      if (!finalPhoto?.uri) {
        throw new Error('No capture')
      }

      await uploadBodyScanUri(finalPhoto.uri)
      router.replace('/vto/body-scan-ready')
    } catch (error) {
      Alert.alert('Body scan nije sacuvan', 'Pokusaj ponovo sa boljim svetlom i cistom pozadinom.')
    } finally {
      setBusy(false)
    }
  }

  if (!permission) {
    return <BrandedLoader />
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas px-5">
        <Text className="text-center font-sans text-sm leading-6 text-ink-dark/65">
          Kamera je potrebna za body scan flow.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="mt-5 items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            Dozvoli kameru
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  const ready = analysis.ready && stableReadyCount >= 2

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        facing="front"
        style={{ flex: 1 }}
      />

      <View className="absolute inset-0 bg-black/20" />

      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute left-4 top-14 h-11 w-11 items-center justify-center rounded-full bg-black/35"
      >
        <Ionicons name="arrow-back" size={20} color="white" />
      </TouchableOpacity>

      <View className="absolute inset-x-8 top-28 bottom-36 items-center justify-center">
        <View
          className={`h-[74%] w-[72%] rounded-[180px] border-2 ${
            ready ? 'border-brand-highlight' : 'border-signal-danger'
          } bg-white/5`}
        />
      </View>

      <View className="absolute bottom-10 left-5 right-5 rounded-[28px] bg-black/40 px-5 py-5">
        <Text className={`font-display text-3xl ${ready ? 'text-brand-highlight' : 'text-base-canvas'}`}>
          {ready ? 'Savršeno' : 'Silueta u magli'}
        </Text>
        <Text className="mt-3 font-sans text-sm leading-6 text-base-canvas/82">
          {analysis.message}
        </Text>

        <TouchableOpacity
          onPress={captureFinal}
          disabled={!ready || busy}
          className={`mt-5 items-center rounded-full px-4 py-4 ${
            ready && !busy ? 'bg-brand-accent-deep' : 'bg-white/12'
          }`}
        >
          {busy ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className={`font-sans text-base font-semibold ${ready ? 'text-base-canvas' : 'text-base-canvas/45'}`}>
              Sačuvaj body scan
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
