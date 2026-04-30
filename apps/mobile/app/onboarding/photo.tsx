import { Ionicons } from '@expo/vector-icons'
import { Alert } from '@/lib/velveAlert'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Image, StatusBar, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { GlassSurface } from '@/components/GlassSurface'
import { OnboardingAnimatedBlock } from '@/components/OnboardingAnimatedBlock'
import { OnboardingProgressHeader } from '@/components/OnboardingProgressHeader'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'
import { uploadImageUri } from '@/lib/imageRequests'

const COPY = {
  sr: {
    step: 'Korak 6 od 6',
    mood: 'trust signal',
    title: 'Dodaj profilnu sliku da ljudi znaju sa kim ulaze u razmenu.',
    description:
      'P2P trade radi bolje kada profil deluje stvarno. Mozes da slikas odmah, izaberes iz galerije ili preskocis za sada.',
    camera: 'Slikaj kamerom',
    gallery: 'Izaberi iz galerije',
    save: 'Sacuvaj i nastavi',
    change: 'Izaberi drugu',
    skip: 'Preskoci za sada',
    permissionTitle: 'Dozvola',
    cameraPermission: 'Potrebna je dozvola za kameru.',
    galleryPermission: 'Potrebna je dozvola za galeriju.',
    errorTitle: 'Greska',
    pickError: 'Ne mogu da otvorim izbor slike.',
    saveError: 'Profilna slika trenutno nije sacuvana.',
  },
  en: {
    step: 'Step 6 of 6',
    mood: 'trust signal',
    title: 'Add a profile photo so people know who they are trading with.',
    description:
      'Peer-to-peer trading works better when the profile feels real. Take a photo, choose one, or skip for now.',
    camera: 'Use camera',
    gallery: 'Choose from gallery',
    save: 'Save and continue',
    change: 'Choose another',
    skip: 'Skip for now',
    permissionTitle: 'Permission',
    cameraPermission: 'Camera permission is required.',
    galleryPermission: 'Gallery permission is required.',
    errorTitle: 'Error',
    pickError: 'Could not open image picker.',
    saveError: 'Profile photo could not be saved.',
  },
  ru: {
    step: 'Шаг 6 из 6',
    mood: 'trust signal',
    title: 'Добавь фото профиля, чтобы люди знали, с кем меняются.',
    description:
      'P2P trade лучше работает, когда профиль выглядит реальным. Сделай фото, выбери из галереи или пропусти.',
    camera: 'Снять камерой',
    gallery: 'Выбрать из галереи',
    save: 'Сохранить и продолжить',
    change: 'Выбрать другое',
    skip: 'Пропустить',
    permissionTitle: 'Доступ',
    cameraPermission: 'Нужен доступ к камере.',
    galleryPermission: 'Нужен доступ к галерее.',
    errorTitle: 'Ошибка',
    pickError: 'Не удалось открыть выбор фото.',
    saveError: 'Фото профиля не сохранено.',
  },
} as const

export default function OnboardingPhotoScreen() {
  const router = useRouter()
  const { refreshDbUser } = useAuth()
  const { locale } = useI18n()
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [busySource, setBusySource] = useState<'camera' | 'gallery' | 'save' | null>(null)
  const copy = COPY[locale]
  const unlockLabel = locale === 'sr' ? 'Otkljucan trust signal' : 'Trust signal unlocked'

  async function pickPhoto(source: 'camera' | 'gallery') {
    try {
      setBusySource(source)

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          Alert.alert(copy.permissionTitle, copy.cameraPermission)
          return
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        })

        if (!result.canceled && result.assets[0]?.uri) {
          setPhotoUri(result.assets[0].uri)
        }
        return
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(copy.permissionTitle, copy.galleryPermission)
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      })

      if (!result.canceled && result.assets[0]?.uri) {
        setPhotoUri(result.assets[0].uri)
      }
    } catch {
      Alert.alert(copy.errorTitle, copy.pickError)
    } finally {
      setBusySource(null)
    }
  }

  async function savePhoto() {
    if (!photoUri) return

    try {
      setBusySource('save')
      const upload = await uploadImageUri(photoUri)
      await client.put('/api/users/me', { photoURL: upload.url })
      await refreshDbUser()
      router.push('/onboarding/scan')
    } catch (error: any) {
      Alert.alert(copy.errorTitle, error?.response?.data?.error || error?.message || copy.saveError)
    } finally {
      setBusySource(null)
    }
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />
      <BrandBackground />

      <View className="flex-1 justify-between pb-10">
        <View>
          <OnboardingProgressHeader
            stepLabel={copy.step}
            progress={6 / 6}
            unlockLabel={unlockLabel}
            onBack={() => router.back()}
          />
          <TouchableOpacity
            onPress={() => router.push('/onboarding/scan')}
            disabled={busySource === 'save'}
            className="absolute right-5 top-14 z-20 rounded-full bg-surface-panel px-4 py-2.5"
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark/60">
              {copy.skip}
            </Text>
          </TouchableOpacity>

          <OnboardingAnimatedBlock className="px-gutter">
            <View className="mb-4 self-start rounded-full bg-brand-highlight/30 px-3 py-1.5">
              <Text className="font-sans text-xs font-semibold uppercase text-ink-dark/55">
                Opcionalno
              </Text>
            </View>
            <Text className="mt-1 font-logo text-[30px] leading-none text-brand-accent-deep/72">
              {copy.mood}
            </Text>
            <Text className="mt-4 font-display text-[38px] leading-[40px] text-ink-dark">
              {copy.title}
            </Text>
            <Text className="mt-4 max-w-[344px] font-sans text-base leading-7 text-ink-dark/68">
              {copy.description}
            </Text>
          </OnboardingAnimatedBlock>
        </View>

        <GlassSurface className="mx-gutter items-center px-5 py-6">
          <View className="h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-brand-accent-light/25">
            {photoUri ? (
              <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Ionicons name="person-outline" size={54} color={colors.accentDeep} />
            )}
          </View>

          {photoUri ? (
            <TouchableOpacity onPress={() => setPhotoUri(null)} className="mt-4">
              <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                {copy.change}
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="mt-6 w-full gap-3">
              <TouchableOpacity
                onPress={() => pickPhoto('camera')}
                disabled={Boolean(busySource)}
                className="items-center rounded-pill bg-brand-accent-deep px-5 py-4"
              >
                {busySource === 'camera' ? (
                  <ActivityIndicator color={colors.baseCanvas} />
                ) : (
                  <Text className="font-sans text-base font-semibold text-base-canvas">
                    {copy.camera}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickPhoto('gallery')}
                disabled={Boolean(busySource)}
                className="items-center rounded-pill border border-ink-dark/10 bg-base-canvas/70 px-5 py-4"
              >
                {busySource === 'gallery' ? (
                  <ActivityIndicator color={colors.inkDark} />
                ) : (
                  <Text className="font-sans text-base font-medium text-ink-dark/70">
                    {copy.gallery}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </GlassSurface>

        <View className="px-gutter">
          {photoUri ? (
            <TouchableOpacity
              onPress={savePhoto}
              disabled={Boolean(busySource)}
              className="items-center rounded-pill bg-brand-highlight px-5 py-4"
            >
              {busySource === 'save' ? (
                <ActivityIndicator color={colors.inkDark} />
              ) : (
                <Text className="font-sans text-base font-semibold text-ink-dark">
                  {copy.save}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )
}
