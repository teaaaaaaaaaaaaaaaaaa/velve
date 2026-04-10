import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'

type PublicUser = {
  _id: string
  displayName: string
  photoURL?: string
  bio?: string
  averageRating?: number
  completedTrades?: number
  followersCount?: number
  followingCount?: number
  itemsCount?: number
  location?: { city?: string; region?: string }
  isSelf?: boolean
  isFollowing?: boolean
  joinedAt?: string
  responseRate?: number | null
  successfulSwaps?: number
  profileCompleteness?: number
}

function TrustPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <View className="mb-3 w-[48%] rounded-[22px] bg-base-canvas px-4 py-4">
      <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
        {label}
      </Text>
      <Text className="mt-1 font-display text-2xl text-ink-dark">{value}</Text>
    </View>
  )
}

export default function PublicProfileScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [items, setItems] = useState<DiscoveryCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)

  const loadProfile = async () => {
    try {
      setLoading(true)
      const [userResponse, itemsResponse] = await Promise.all([
        client.get(`/api/users/${id}`),
        client.get('/api/items', { params: { userId: id, limit: 30 } }),
      ])

      if (userResponse.data.ok) {
        const userData = userResponse.data.data as PublicUser
        setUser(userData)
        setIsFollowing(Boolean(userData.isFollowing))
        setFollowersCount(userData.followersCount || 0)
      }

      if (itemsResponse.data.ok) {
        setItems(itemsResponse.data.data as DiscoveryCardItem[])
      }
    } catch {
      setUser(null)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      loadProfile()
    }
  }, [id])

  useEffect(() => {
    if (user?.isSelf) {
      router.replace('/(tabs)/profile')
    }
  }, [router, user?.isSelf])

  const handleReport = async () => {
    if (!id) return
    try {
      await client.post(`/api/users/${id}/report`, { reason: 'community_report' })
      Alert.alert('Hvala', 'Profil je prijavljen i pregledace ga tim.')
    } catch {
      Alert.alert('Greska', 'Prijava trenutno nije moguca.')
    }
  }

  const handleBlock = async () => {
    if (!id || !user) return
    try {
      await client.post(`/api/users/${id}/block`)
      Alert.alert('Korisnik blokiran', `Sadrzaj profila @${user.displayName} vise ti se nece prikazivati.`, [
        {
          text: 'U redu',
          onPress: () => router.replace('/(tabs)/feed'),
        },
      ])
    } catch {
      Alert.alert('Greska', 'Blokiranje trenutno nije moguce.')
    }
  }

  const handleMoreOptions = () => {
    Alert.alert(`@${user?.displayName || 'Korisnik'}`, 'Sta zelis da uradis?', [
      { text: 'Prijavi profil', onPress: handleReport },
      { text: 'Blokiraj korisnika', style: 'destructive', onPress: handleBlock },
      { text: 'Odustani', style: 'cancel' },
    ])
  }

  const handleOpenChat = async () => {
    if (!id) return
    try {
      const response = await client.post(`/api/chat/direct/${id}`)
      if (response.data.ok) {
        router.push(`/(tabs)/chat/${response.data.data.chatId as string}`)
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce otvoriti razgovor.')
    }
  }

  const handleFollow = async () => {
    if (!id || followLoading) return

    setFollowLoading(true)
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowersCount((prev) => prev + (wasFollowing ? -1 : 1))

    try {
      if (wasFollowing) {
        await client.delete(`/api/users/${id}/follow`)
      } else {
        await client.post(`/api/users/${id}/follow`)
      }
    } catch {
      setIsFollowing(wasFollowing)
      setFollowersCount((prev) => prev + (wasFollowing ? 1 : -1))
      Alert.alert('Greska', 'Pracenje trenutno nije moguce.')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BrandedLoader />
      </>
    )
  }

  if (!user) {
    return (
      <View className="flex-1 bg-base-canvas px-4 pt-20">
        <Stack.Screen options={{ headerShown: false }} />
        <EditorialEmptyState
          icon="person-outline"
          title="Profil trenutno nije dostupan"
          description="Moguce je da je korisnik blokiran, uklonjen ili da je veza kratko pukla."
          actionLabel="Nazad na feed"
          onAction={() => router.replace('/(tabs)/feed')}
        />
      </View>
    )
  }

  if (user.isSelf) return null

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5 pb-8 pt-14">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={22} color="#2B2A2B" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMoreOptions}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#2B2A2B" />
          </TouchableOpacity>
        </View>

        <View className="overflow-hidden rounded-[34px] border border-ink-dark/6 bg-surface-panel px-5 pb-5 pt-6"
          style={{ shadowColor: '#2B2A2B', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
        >

          <View className="flex-row items-center">
            {user.photoURL ? (
              <RemoteImage
                uri={user.photoURL}
                className="h-24 w-24 rounded-full"
                fallback={
                  <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/40">
                    <Text className="font-display text-4xl text-brand-accent-deep">
                      {user.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
              />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-accent-light/40">
                <Text className="font-display text-4xl text-brand-accent-deep">
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="font-display text-4xl text-ink-dark">{user.displayName}</Text>
              {user.location?.city ? (
                <Text className="mt-1 font-sans text-sm text-ink-dark/55">
                  {user.location.city}
                  {user.location.region ? `, ${user.location.region}` : ''}
                </Text>
              ) : null}
              <Text className="mt-2 font-sans text-sm text-brand-accent-deep">
                {user.joinedAt
                  ? `Od ${new Date(user.joinedAt).toLocaleDateString('sr-Latn', {
                      month: 'long',
                      year: 'numeric',
                    })}`
                  : 'Novi clan'}
              </Text>
            </View>
          </View>

          <Text className="mt-5 font-sans text-sm leading-6 text-ink-dark/75">
            {user.bio || 'Profil jos nema opis, ali trust signal i garderoba ispod vec govore o stilu ovog naloga.'}
          </Text>

          <View className="mt-5 flex-row rounded-[24px] bg-base-canvas px-4 py-4">
            <View className="flex-1 items-center">
              <Text className="font-display text-2xl text-ink-dark">{user.itemsCount || items.length}</Text>
              <Text className="font-sans text-xs text-ink-dark/50">Objave</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="font-display text-2xl text-ink-dark">{followersCount}</Text>
              <Text className="font-sans text-xs text-ink-dark/50">Pratioci</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="font-display text-2xl text-ink-dark">{user.followingCount || 0}</Text>
              <Text className="font-sans text-xs text-ink-dark/50">Prati</Text>
            </View>
          </View>

          <View className="mt-5 flex-row items-center gap-3">
            <TouchableOpacity
              onPress={handleFollow}
              disabled={followLoading}
              className={`flex-1 items-center rounded-full px-4 py-3 ${isFollowing ? 'border border-ink-dark/10 bg-base-canvas' : 'bg-brand-accent-deep'}`}
            >
              <Text className={`font-sans text-sm font-semibold ${isFollowing ? 'text-ink-dark' : 'text-base-canvas'}`}>
                {isFollowing ? 'Otprati' : 'Zaprati'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenChat}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/25"
            >
              <Ionicons name="chatbubble-outline" size={20} color="#431A43" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-8">
          <Text className="font-display text-3xl text-ink-dark">Trust signali</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
            Javno vidljivi pokazatelji koji cine profil pouzdanijim za trade odluke.
          </Text>

          <View className="mt-4 flex-row flex-wrap justify-between">
            <TrustPill
              label="Ocena"
              value={user.averageRating ? user.averageRating.toFixed(1) : 'Novi profil'}
            />
            <TrustPill
              label="Swaps"
              value={String(user.successfulSwaps || user.completedTrades || 0)}
            />
            <TrustPill
              label="Response rate"
              value={user.responseRate == null ? 'N/A' : `${user.responseRate}%`}
            />
            <TrustPill
              label="Profil"
              value={`${user.profileCompleteness || 0}%`}
            />
          </View>
        </View>

        <View className="mt-8">
          <Text className="font-display text-3xl text-ink-dark">Objave</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
            Aktivni komadi ovog profila koji su trenutno dostupni za discovery, trade ili kupovinu.
          </Text>

          {items.length === 0 ? (
            <View className="mt-4">
              <EditorialEmptyState
                icon="shirt-outline"
                title="Trenutno nema aktivnih objava"
                description="Korisnik trenutno nema dostupnih komada za otvaranje iz discovery sloja."
              />
            </View>
          ) : (
            <View className="mt-4 flex-row flex-wrap justify-between">
              {items.map((item) => (
                <View key={item._id} style={{ width: '48%' }}>
                  <DiscoveryItemCard
                    item={item}
                    onPress={() => router.push(`/items/${item._id}`)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )
}
