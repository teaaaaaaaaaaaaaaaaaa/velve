import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native'

import { colors } from '@/design/tokens'
import { uploadBodyScanUri } from '@/lib/imageRequests'

type BodyScanRouteParams = {
  returnTo?: string | string[]
  itemId?: string | string[]
  itemIds?: string | string[]
  mode?: string | string[]
}

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default function BodyScanCameraScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<BodyScanRouteParams>()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickingSource, setPickingSource] = useState<'camera' | 'library' | null>(null)

  const returnTo = normalizeParam(params.returnTo)
  const itemId = normalizeParam(params.itemId)
  const itemIds = normalizeParam(params.itemIds)
  const mode = normalizeParam(params.mode)

  async function openCamera() {
    try {
      setPickingSource('camera')
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Kamera nije dozvoljena', 'Dozvoli kameru da bi napravio body scan fotografiju.')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        exif: false,
        cameraType: ImagePicker.CameraType.front,
      })

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri)
      }
    } catch (error: any) {
      Alert.alert('Kamera nije otvorena', error?.message || 'Pokusaj ponovo.')
    } finally {
      setPickingSource(null)
    }
  }

  async function openLibrary() {
    try {
      setPickingSource('library')
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Galerija nije dozvoljena', 'Dozvoli pristup fotografijama ili snimi novu fotografiju kamerom.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        exif: false,
      })

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri)
      }
    } catch (error: any) {
      Alert.alert('Fotografija nije izabrana', error?.message || 'Pokusaj ponovo.')
    } finally {
      setPickingSource(null)
    }
  }

  async function saveBodyScan() {
    if (!photoUri) return

    try {
      setSaving(true)
      await uploadBodyScanUri(photoUri)
      router.replace({
        pathname: '/vto/body-scan-ready',
        params: {
          ...(returnTo ? { returnTo } : {}),
          ...(itemId ? { itemId } : {}),
          ...(itemIds ? { itemIds } : {}),
          ...(mode ? { mode } : {}),
        },
      })
    } catch (error: any) {
      Alert.alert(
        'Body scan nije sacuvan',
        error?.response?.data?.error ||
          error?.message ||
          'Pokusaj ponovo sa jasnijom fotografijom celog tela.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-base-canvas px-5 pb-8 pt-14">
      <TouchableOpacity
        onPress={() => router.back()}
        className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
      >
        <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
      </TouchableOpacity>

      <Text className="mt-8 font-display text-4xl text-ink-dark">Body scan fotografija</Text>
      <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
        Snimi ili izaberi jednu fotografiju celog tela. Bez automatskog cekanja: pogledas preview,
        ponovis ako treba, pa sacuvas.
      </Text>

      <View className="mt-6 flex-1 overflow-hidden rounded-[28px] bg-surface-panel">
        {photoUri ? (
          <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="contain" />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="body-outline" size={46} color={colors.accentDeep} />
            <Text className="mt-4 text-center font-sans text-sm leading-6 text-ink-dark/58">
              Cela figura treba da bude vidljiva, sa mirnom pozadinom i dobrim svetlom.
            </Text>
          </View>
        )}
      </View>

      {photoUri ? (
        <View className="mt-5 gap-3">
          <TouchableOpacity
            onPress={saveBodyScan}
            disabled={saving}
            className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.baseCanvas} />
            ) : (
              <Text className="font-sans text-base font-semibold text-base-canvas">
                Sacuvaj body scan
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPhotoUri(null)}
            disabled={saving}
            className="items-center rounded-full bg-surface-panel px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-ink-dark">
              Izaberi drugu fotografiju
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="mt-5 gap-3">
          <TouchableOpacity
            onPress={openCamera}
            disabled={Boolean(pickingSource)}
            className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            {pickingSource === 'camera' ? (
              <ActivityIndicator size="small" color={colors.baseCanvas} />
            ) : (
              <Text className="font-sans text-base font-semibold text-base-canvas">
                Snimi fotografiju
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openLibrary}
            disabled={Boolean(pickingSource)}
            className="items-center rounded-full bg-surface-panel px-4 py-4"
          >
            {pickingSource === 'library' ? (
              <ActivityIndicator size="small" color={colors.inkDark} />
            ) : (
              <Text className="font-sans text-base font-semibold text-ink-dark">
                Izaberi iz galerije
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
