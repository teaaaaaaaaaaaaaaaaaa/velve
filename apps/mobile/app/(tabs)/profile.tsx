import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { GlassSurface } from '@/components/GlassSurface'
import { ProfileSkeleton } from '@/components/BrandedLoader'
import { DiscoveryCardItem } from '@/components/DiscoveryItemCard'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

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
  stylePreferences?: string[]
  categories?: string[]
  favoriteBrands?: string[]
  location?: { city?: string; region?: string }
}


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

function getResponseRateLabel(rate: number | null, label: string, emptyLabel: string) {
  if (rate == null) return emptyLabel
  return label.replace('{{value}}', String(rate))
}


function SectionHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View className="mb-4 flex-row items-end justify-between">
      <View className="flex-1 pr-4">
        <Text className="font-display text-3xl text-ink-dark">{title}</Text>
        <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">{description}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}


export default function ProfileScreen() {
  const router = useRouter()
const { t, formatDate } = useI18n()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'liked'>('posts')
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
      profile.favoriteBrands?.[0] ? `Brand pulse: ${profile.favoriteBrands[0]}` : null,
      profile.categories?.[0] ? `Vibe: ${profile.categories[0]}` : null,
      profile.stylePreferences?.[0] ? profile.stylePreferences[0] : null,
      profile.emailVerified ? 'Email verifikovan' : null,
    ].filter(Boolean) as string[]
  }, [profile])

  const hydrateEditState = useCallback((nextProfile: UserProfile) => {
    setEditDisplayName(nextProfile.displayName || '')
    setEditBio(nextProfile.bio || '')
    setEditPhotoURL(nextProfile.photoURL || '')
  }, [])

  const loadProfile = useCallback(async () => {
    const profileResponse = await client.get('/api/users/me').catch((e) => ({ status: 'rejected' as const, reason: e }))

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

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await loadProfile()
    } finally {
      setRefreshing(false)
    }
  }, [loadProfile])

  const loadTabContent = useCallback(async (tab: 'posts' | 'saved' | 'liked') => {
    setTabLoading(true)
    try {
      if (tab === 'posts') {
        const res = await client.get('/api/items/closet')
        if (res.data.ok) setClosetItems(res.data.data.live || [])
      } else if (tab === 'saved') {
        const res = await client.get('/api/wishlist')
        if (res.data.ok) setWishlistItems(res.data.data || [])
      }
    } catch {
      // silent fail
    } finally {
      setTabLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTabContent('posts')
  }, [loadTabContent])

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

          <GlassSurface className="overflow-hidden rounded-editorial px-5 pb-5 pt-6">
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
              {profile.bio ||
                'Dodaj kratku belešku o svom ukusu kako bi profil delovao kao licni editorial, a ne kao prazan nalog.'}
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

            <View className="mt-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="font-sans text-sm text-ink-dark/65">Kompletnost profila</Text>
                <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                  {profile.profileCompleteness}%
                </Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-brand-accent-light/30">
                <View
                  className="h-full rounded-full bg-brand-accent-deep"
                  style={{ width: `${profile.profileCompleteness}%` }}
                />
              </View>
            </View>

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
              {profile.averageRating > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-brand-highlight/30 px-3 py-1.5">
                  <Ionicons name="star" size={12} color={colors.inkDark} />
                  <Text className="font-sans text-xs font-semibold text-ink-dark">{profile.averageRating.toFixed(1)}</Text>
                </View>
              )}
              {profile.successfulSwaps > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-brand-accent-light/30 px-3 py-1.5">
                  <Ionicons name="repeat-outline" size={12} color={colors.accentDeep} />
                  <Text className="font-sans text-xs text-brand-accent-deep">{profile.successfulSwaps} razmena</Text>
                </View>
              )}
              {profile.responseRate != null && (
                <View className="flex-row items-center gap-1 rounded-full bg-surface-soft px-3 py-1.5">
                  <Ionicons name="time-outline" size={12} color={colors.inkDark} />
                  <Text className="font-sans text-xs text-ink-dark/70">{profile.responseRate}% response</Text>
                </View>
              )}
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

            <TouchableOpacity
              className="mt-3 flex-row items-center justify-between rounded-[24px] border border-brand-accent-deep/10 bg-brand-accent-deep px-4 py-4"
              onPress={() => router.push('/(tabs)/trades')}
            >
              <View className="flex-1 pr-4">
                <Text className="font-sans text-[11px] uppercase tracking-[1.4px] text-base-canvas/70">
                  {t('profile.tradeDesk')}
                </Text>
                <Text className="mt-1 font-display text-2xl text-base-canvas">
                  Aktivni i zavrseni zahtevi na jednom mestu
                </Text>
              </View>
              <Ionicons name="swap-horizontal" size={28} color={colors.baseCanvas} />
            </TouchableOpacity>
          </GlassSurface>

          <View className="mt-5 overflow-hidden rounded-[28px] bg-surface-panel px-5 py-5"
            style={{ shadowColor: '#2B2A2B', shadowOpacity: 0.07, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
          >
            <SectionHeader
              title="Wardrobe control"
              description="Draft, active i archive tok sada imaju odvojene lane-ove i bulk akcije."
              actionLabel="Otvori closet"
              onAction={() => router.push('/(tabs)/closet')}
            />
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-[22px] bg-surface-soft px-4 py-4">
                <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
                  {t('profile.live')}
                </Text>
                <Text className="mt-1 font-display text-3xl text-ink-dark">
                  {profile.closetCounts.live}
                </Text>
              </View>
              <View className="flex-1 rounded-[22px] bg-surface-soft px-4 py-4">
                <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
                  {t('profile.drafts')}
                </Text>
                <Text className="mt-1 font-display text-3xl text-ink-dark">
                  {profile.closetCounts.drafts}
                </Text>
              </View>
              <View className="flex-1 rounded-[22px] bg-surface-soft px-4 py-4">
                <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
                  {t('profile.archive')}
                </Text>
                <Text className="mt-1 font-display text-3xl text-ink-dark">
                  {profile.closetCounts.archive}
                </Text>
              </View>
            </View>
            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center rounded-full border border-ink-dark/8 bg-base-canvas px-4 py-3"
                onPress={() => router.push('/(tabs)/upload')}
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">
                  {t('profile.newListing')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 items-center rounded-full border border-ink-dark/8 bg-base-canvas px-4 py-3"
                onPress={() => router.push('/(tabs)/wishlist')}
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">
                  {t('profile.wishlist')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* TikTok-style tabs */}
          <View className="mt-6">
            {/* Tab bar */}
            <View className="flex-row border-b border-ink-dark/10">
              {[
                { key: 'posts', label: 'Objave', icon: 'grid-outline' },
                { key: 'saved', label: 'Sacuvano', icon: 'bookmark-outline' },
                { key: 'liked', label: 'Lajkovano', icon: 'heart-outline' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  className="flex-1 items-center py-3"
                  onPress={() => {
                    setActiveTab(tab.key as any)
                    loadTabContent(tab.key as any)
                  }}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={20}
                    color={activeTab === tab.key ? colors.accentDeep : colors.mutedText}
                  />
                  <View
                    className={`mt-2 h-0.5 w-8 rounded-full ${
                      activeTab === tab.key ? 'bg-brand-accent-deep' : 'bg-transparent'
                    }`}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab content */}
            {tabLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator color={colors.accentDeep} />
              </View>
            ) : activeTab === 'posts' ? (
              closetItems.length === 0 ? (
                <EditorialEmptyState
                  icon="shirt-outline"
                  title="Tvoj ormar je prazan"
                  description="Dodaj prve komade i postavi ih u discovery."
                  actionLabel="Dodaj komad"
                  onAction={() => router.push('/(tabs)/upload')}
                />
              ) : (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {closetItems.map((item: any) => (
                    <TouchableOpacity
                      key={item._id}
                      style={{ width: '48%' }}
                      onPress={() => router.push(`/items/${item._id}`)}
                      className="overflow-hidden rounded-card"
                    >
                      {item.images?.[0] ? (
                        <RemoteImage
                          uri={item.images[0]}
                          className="aspect-[3/4] w-full rounded-card bg-surface-soft"
                        />
                      ) : (
                        <View className="aspect-[3/4] w-full items-center justify-center rounded-card bg-surface-tint">
                          <Ionicons name="image-outline" size={32} color={colors.mutedText} />
                        </View>
                      )}
                      <Text className="mt-1.5 font-sans text-sm font-semibold text-ink-dark" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.brand && (
                        <Text className="font-sans text-xs text-ink-dark/50" numberOfLines={1}>
                          {item.brand}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : activeTab === 'saved' ? (
              wishlistItems.length === 0 ? (
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
                    <TouchableOpacity
                      key={item._id}
                      style={{ width: '48%' }}
                      onPress={() => router.push(`/items/${item._id}`)}
                      className="overflow-hidden rounded-card"
                    >
                      {item.images?.[0] ? (
                        <RemoteImage
                          uri={item.images[0]}
                          className="aspect-[3/4] w-full rounded-card bg-surface-soft"
                        />
                      ) : (
                        <View className="aspect-[3/4] w-full items-center justify-center rounded-card bg-surface-tint">
                          <Ionicons name="image-outline" size={32} color={colors.mutedText} />
                        </View>
                      )}
                      <Text className="mt-1.5 font-sans text-sm font-semibold text-ink-dark" numberOfLines={1}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : (
              <EditorialEmptyState
                icon="heart-outline"
                title="Nema lajkovanih komada"
                description="Lajkuj komade u feedu i nadi ih ovde."
                actionLabel="Idi na feed"
                onAction={() => router.push('/(tabs)/feed')}
              />
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
                placeholder="Par reci o svom ukusu, silueti i komadima koje volis."
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
