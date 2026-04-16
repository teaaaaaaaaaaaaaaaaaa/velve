import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { ProfileSkeleton } from '@/components/BrandedLoader'
import { DiscoveryCardItem } from '@/components/DiscoveryItemCard'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { getPrimaryItemImage } from '@/lib/itemImages'

type ClosetCounts = {
  live: number
  drafts: number
  archive: number
}

type UserProfile = {
  _id: string
  email: string
  displayName: string
  photoURL: string
  bio: string
  emailVerified: boolean
  averageRating: number
  completedTrades: number
  followersCount: number
  followingCount: number
  itemsCount: number
  joinedAt?: string
  responseRate: number | null
  successfulSwaps: number
  profileCompleteness: number
  closetCounts: ClosetCounts
  favoriteBrands?: string[]
  location?: { city?: string; region?: string }
}

const ProfileGridItem = memo(function ProfileGridItem({
  item,
  onPress,
}: {
  item: { _id: string; title: string; images?: string[]; imageClean?: string | null; primaryImage?: string | null; isDigitized?: boolean; brand?: string }
  onPress: () => void
}) {
  const imageUri = getPrimaryItemImage(item)

  return (
    <TouchableOpacity
      style={{ width: '48%' }}
      onPress={onPress}
      className="overflow-hidden rounded-[24px]"
    >
      {imageUri ? (
        <RemoteImage
          uri={imageUri}
          className="aspect-[3/4] w-full rounded-[24px] bg-surface-soft"
        />
      ) : (
        <View className="aspect-[3/4] w-full items-center justify-center rounded-[24px] bg-surface-tint">
          <Ionicons name="image-outline" size={32} color={colors.mutedText} />
        </View>
      )}
      <Text className="mt-1.5 font-sans text-sm font-semibold text-ink-dark" numberOfLines={1}>
        {item.title}
      </Text>
      {item.brand ? (
        <Text className="font-sans text-xs text-ink-dark/50" numberOfLines={1}>
          {item.brand}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
})

function formatJoinedDate(
  date: string | undefined,
  formatter: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string,
  joinedLabel: string,
  newMemberLabel: string
) {
  if (!date) return newMemberLabel

  return joinedLabel.replace(
    '{{date}}',
    formatter(date, {
      month: 'long',
      year: 'numeric',
    })
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const { t, formatDate } = useI18n()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts')
  const [closetItems, setClosetItems] = useState<any[]>([])
  const [wishlistItems, setWishlistItems] = useState<DiscoveryCardItem[]>([])
  const [tabLoading, setTabLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPhotoURL, setEditPhotoURL] = useState('')

  const identityChips = useMemo(() => {
    if (!profile) return []

    return [
      profile.location?.city
        ? `${profile.location.city}${profile.location.region ? `, ${profile.location.region}` : ''}`
        : null,
      profile.favoriteBrands?.[0] ? `Brand: ${profile.favoriteBrands[0]}` : null,
      profile.emailVerified ? 'Email verifikovan' : null,
    ].filter(Boolean) as string[]
  }, [profile])

  const hydrateEditState = useCallback((nextProfile: UserProfile) => {
    setEditDisplayName(nextProfile.displayName || '')
    setEditBio(nextProfile.bio || '')
    setEditPhotoURL(nextProfile.photoURL || '')
  }, [])

  const loadProfile = useCallback(async () => {
    const profileResponse = await client
      .get('/api/users/me')
      .catch((error) => ({ status: 'rejected' as const, reason: error }))

    if ('data' in profileResponse && profileResponse.data.ok) {
      const nextProfile = profileResponse.data.data as UserProfile
      setProfile(nextProfile)
      hydrateEditState(nextProfile)
    } else {
      throw new Error('Profil trenutno nije moguce ucitati.')
    }
  }, [hydrateEditState])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      await loadProfile()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Profil trenutno nije moguce ucitati.'
      Alert.alert('Greska', message)
    } finally {
      setLoading(false)
    }
  }, [loadProfile])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const loadTabContent = useCallback(async (tab: 'posts' | 'saved') => {
    setTabLoading(true)
    try {
      if (tab === 'posts') {
        const response = await client.get('/api/items/closet')
        if (response.data.ok) {
          setClosetItems(response.data.data.live || [])
        }
      } else {
        const response = await client.get('/api/wishlist')
        if (response.data.ok) {
          setWishlistItems(response.data.data || [])
        }
      }
    } catch {
      // Keep the section quiet and retry on next refresh.
    } finally {
      setTabLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTabContent('posts')
  }, [loadTabContent])

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await Promise.all([loadProfile(), loadTabContent(activeTab)])
    } finally {
      setRefreshing(false)
    }
  }, [activeTab, loadProfile, loadTabContent])

  const handlePickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (permission.status !== 'granted') {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup galeriji.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })

    if (!result.canceled && result.assets[0]) {
      try {
        setUploading(true)
        const uri = result.assets[0].uri
        const filename = uri.split('/').pop() || 'avatar.jpg'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'
        const formData = new FormData()
        formData.append('image', { uri, name: filename, type } as never)

        const response = await client.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        if (response.data.ok) {
          setEditPhotoURL(response.data.data.url as string)
        }
      } catch {
        Alert.alert('Greska', 'Avatar trenutno nije moguce uploadovati.')
      } finally {
        setUploading(false)
      }
    }
  }, [])

  const handleSaveProfile = useCallback(async () => {
    if (!editDisplayName.trim()) {
      Alert.alert('Greska', 'Ime ne moze biti prazno.')
      return
    }

    try {
      setUploading(true)
      const response = await client.put('/api/users/me', {
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        photoURL: editPhotoURL,
      })

      if (response.data.ok) {
        const nextProfile = response.data.data as UserProfile
        setProfile(nextProfile)
        hydrateEditState(nextProfile)
        setModalVisible(false)
      }
    } catch {
      Alert.alert('Greska', 'Profil nije sacuvan.')
    } finally {
      setUploading(false)
    }
  }, [editBio, editDisplayName, editPhotoURL, hydrateEditState])

  if (loading) {
    return <ProfileSkeleton />
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-base-canvas px-4 pt-24">
        <EditorialEmptyState
          icon="person-outline"
          title={t('profile.emptyTitle')}
          description={t('profile.emptyDescription')}
          actionLabel={t('common.refresh')}
          onAction={loadAll}
        />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-base-canvas"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <BrandBackground />
        <View className="px-5 pb-8 pt-14">
          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <BrandWordmark width={118} />
              <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
                {t('profile.eyebrow')}
              </Text>
              <Text className="font-display text-4xl text-ink-dark">{t('profile.title')}</Text>
            </View>
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-full bg-surface-tint"
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={20} color={colors.accentDeep} />
            </TouchableOpacity>
          </View>

          <View
            className="overflow-hidden rounded-[32px] bg-surface-panel px-5 pb-5 pt-6"
            style={{
              shadowColor: colors.inkDark,
              shadowOpacity: 0.08,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <TouchableOpacity activeOpacity={0.88} onPress={() => setModalVisible(true)}>
                {profile.photoURL ? (
                  <RemoteImage
                    uri={profile.photoURL}
                    className="h-24 w-24 rounded-full"
                    fallback={
                      <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/40">
                        <Text className="font-display text-4xl text-brand-accent-deep">
                          {profile.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    }
                  />
                ) : (
                  <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-accent-light/40">
                    <Text className="font-display text-4xl text-brand-accent-deep">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View className="ml-4 flex-1">
                <Text className="font-display text-4xl text-ink-dark">{profile.displayName}</Text>
                <Text className="mt-1 font-sans text-sm text-ink-dark/55">{profile.email}</Text>
                <Text className="mt-2 font-sans text-sm text-brand-accent-deep">
                  {formatJoinedDate(
                    profile.joinedAt,
                    formatDate,
                    t('profile.joinedPrefix'),
                    t('profile.newMember')
                  )}
                </Text>
              </View>
            </View>

            <Text className="mt-5 font-sans text-sm leading-6 text-ink-dark/75">
              {profile.bio || 'Dodaj par reci o svom ukusu da profil deluje zivo i licno.'}
            </Text>

            {identityChips.length > 0 ? (
              <View className="mt-4 flex-row flex-wrap gap-2">
                {identityChips.map((chip) => (
                  <View key={chip} className="rounded-full bg-base-canvas px-3 py-2">
                    <Text className="font-sans text-xs text-ink-dark/70">{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mt-5 flex-row items-center justify-between">
              <View className="items-center">
                <Text className="font-display text-3xl text-ink-dark">{profile.followersCount}</Text>
                <Text className="font-sans text-xs text-ink-dark/50">{t('profile.followers')}</Text>
              </View>
              <View className="items-center">
                <Text className="font-display text-3xl text-ink-dark">{profile.followingCount}</Text>
                <Text className="font-sans text-xs text-ink-dark/50">{t('profile.following')}</Text>
              </View>
              <View className="items-center">
                <Text className="font-display text-3xl text-ink-dark">{profile.closetCounts.live}</Text>
                <Text className="font-sans text-xs text-ink-dark/50">{t('profile.active')}</Text>
              </View>
            </View>

            <View className="mt-4 flex-row flex-wrap gap-2">
              {profile.averageRating > 0 ? (
                <View className="flex-row items-center gap-1 rounded-full bg-brand-highlight/30 px-3 py-1.5">
                  <Ionicons name="star" size={12} color={colors.inkDark} />
                  <Text className="font-sans text-xs font-semibold text-ink-dark">
                    {profile.averageRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {profile.successfulSwaps > 0 ? (
                <View className="flex-row items-center gap-1 rounded-full bg-brand-accent-light/30 px-3 py-1.5">
                  <Ionicons name="repeat-outline" size={12} color={colors.accentDeep} />
                  <Text className="font-sans text-xs text-brand-accent-deep">
                    {profile.successfulSwaps} razmena
                  </Text>
                </View>
              ) : null}
              {profile.responseRate != null ? (
                <View className="flex-row items-center gap-1 rounded-full bg-surface-soft px-3 py-1.5">
                  <Ionicons name="time-outline" size={12} color={colors.inkDark} />
                  <Text className="font-sans text-xs text-ink-dark/70">
                    {profile.responseRate}% response
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-3"
                onPress={() => setModalVisible(true)}
              >
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  {t('profile.edit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 items-center rounded-full border border-ink-dark/10 bg-base-canvas px-4 py-3"
                onPress={() => router.push('/(tabs)/closet')}
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">
                  {t('profile.closet')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-6">
            <View className="mb-4 flex-row rounded-[22px] bg-surface-panel p-1">
              {([
                { key: 'posts', label: 'Objave' },
                { key: 'saved', label: 'Sacuvano' },
              ] as const).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  className={`flex-1 rounded-[18px] px-4 py-3 ${
                    activeTab === tab.key ? 'bg-brand-accent-deep' : ''
                  }`}
                  onPress={() => {
                    setActiveTab(tab.key)
                    loadTabContent(tab.key)
                  }}
                >
                  <Text
                    className={`text-center font-sans text-sm font-semibold ${
                      activeTab === tab.key ? 'text-base-canvas' : 'text-ink-dark/60'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tabLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator color={colors.accentDeep} />
              </View>
            ) : activeTab === 'posts' ? (
              closetItems.length === 0 ? (
                <EditorialEmptyState
                  icon="shirt-outline"
                  title="Tvoj ormar je jos prazan"
                  description="Dodaj prve komade i postavi ih u discovery."
                  actionLabel="Dodaj komad"
                  onAction={() => router.push('/(tabs)/upload')}
                />
              ) : (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {closetItems.map((item: any) => (
                    <ProfileGridItem
                      key={item._id}
                      item={item}
                      onPress={() => router.push(`/items/${item._id}`)}
                    />
                  ))}
                </View>
              )
            ) : wishlistItems.length === 0 ? (
              <EditorialEmptyState
                icon="bookmark-outline"
                title="Nema sacuvanih komada"
                description="Sacuvaj komade iz feeda i nadi ih ovde."
                actionLabel="Idi na feed"
                onAction={() => router.push('/(tabs)/feed')}
              />
            ) : (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {wishlistItems.map((item: any) => (
                  <ProfileGridItem
                    key={item._id}
                    item={item}
                    onPress={() => router.push(`/items/${item._id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-base-canvas">
          <View className="flex-row items-center justify-between border-b border-ink-dark/10 px-6 pb-4 pt-12">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="font-sans text-base text-ink-dark">Zatvori</Text>
            </TouchableOpacity>
            <Text className="font-display text-2xl text-ink-dark">Izmeni profil</Text>
            <TouchableOpacity disabled={uploading} onPress={handleSaveProfile}>
              <Text className="font-sans text-base font-semibold text-brand-accent-deep">
                {uploading ? 'Cuvam...' : 'Sacuvaj'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="items-center">
              {editPhotoURL ? (
                <RemoteImage
                  uri={editPhotoURL}
                  className="h-28 w-28 rounded-full"
                  fallback={
                    <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/40">
                      <Text className="font-display text-4xl text-brand-accent-deep">
                        {editDisplayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  }
                />
              ) : (
                <View className="h-28 w-28 items-center justify-center rounded-full bg-brand-accent-light/40">
                  <Text className="font-display text-4xl text-brand-accent-deep">
                    {editDisplayName.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                className="mt-4 rounded-full bg-brand-accent-deep px-5 py-3"
                onPress={handlePickImage}
                disabled={uploading}
              >
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  {uploading ? 'Upload...' : 'Promeni avatar'}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-8">
              <Text className="mb-2 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
                Ime
              </Text>
              <TextInput
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                maxLength={50}
                placeholder="Tvoje ime"
                placeholderTextColor="#2B2A2B66"
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </View>

            <View className="mt-5">
              <Text className="mb-2 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
                Bio
              </Text>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                maxLength={200}
                multiline
                textAlignVertical="top"
                placeholder="Par reci o svom ukusu i komadima koje volis."
                placeholderTextColor="#2B2A2B66"
                className="min-h-[140px] rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm leading-6 text-ink-dark"
              />
              <Text className="mt-2 font-sans text-xs text-ink-dark/40">{editBio.length}/200</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
