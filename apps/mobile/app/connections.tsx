import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getApiErrorMessage } from '@/lib/apiErrors'

type ConnectionTab = 'followers' | 'following'

type ConnectionUser = {
  _id: string
  displayName?: string
  photoURL?: string
  bio?: string
  averageRating?: number
  completedTrades?: number
  isSelf?: boolean
  isFollowing?: boolean
  location?: { city?: string }
}

export default function ConnectionsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ userId?: string; tab?: ConnectionTab }>()
  const userId = params.userId
  const [activeTab, setActiveTab] = useState<ConnectionTab>(params.tab === 'following' ? 'following' : 'followers')
  const [users, setUsers] = useState<ConnectionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const title = activeTab === 'followers' ? 'Pratioci' : 'Pratis'

  const endpoint = useMemo(() => {
    if (!userId) return ''
    return `/api/users/${userId}/${activeTab}`
  }, [activeTab, userId])

  const loadConnections = useCallback(async () => {
    if (!endpoint) return
    try {
      const response = await client.get(endpoint)
      if (response.data.ok) {
        setUsers(response.data.data || [])
        setErrorMessage('')
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Lista trenutno nije dostupna.'))
    }
  }, [endpoint])

  useEffect(() => {
    loadConnections().finally(() => setLoading(false))
  }, [loadConnections])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadConnections()
    setRefreshing(false)
  }, [loadConnections])

  const toggleFollow = useCallback(async (connection: ConnectionUser) => {
    if (connection.isSelf || busyId) return
    const wasFollowing = Boolean(connection.isFollowing)
    setBusyId(connection._id)
    setUsers((prev) =>
      prev.map((entry) =>
        entry._id === connection._id ? { ...entry, isFollowing: !wasFollowing } : entry
      )
    )
    try {
      if (wasFollowing) {
        await client.delete(`/api/users/${connection._id}/follow`)
      } else {
        await client.post(`/api/users/${connection._id}/follow`)
      }
    } catch {
      setUsers((prev) =>
        prev.map((entry) =>
          entry._id === connection._id ? { ...entry, isFollowing: wasFollowing } : entry
        )
      )
    } finally {
      setBusyId(null)
    }
  }, [busyId])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator color={colors.accentDeep} />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <BrandBackground />
      <View className="px-5 pb-8 pt-14">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Social closet
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">{title}</Text>

        <View className="mt-5 flex-row rounded-[22px] bg-surface-panel p-1">
          {(['followers', 'following'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 rounded-[18px] px-4 py-3 ${activeTab === tab ? 'bg-brand-accent-deep' : ''}`}
              onPress={() => {
                setActiveTab(tab)
                setLoading(true)
              }}
            >
              <Text
                className={`text-center font-sans text-sm font-semibold ${
                  activeTab === tab ? 'text-base-canvas' : 'text-ink-dark/60'
                }`}
              >
                {tab === 'followers' ? 'Pratioci' : 'Pratis'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {errorMessage ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="cloud-offline-outline"
              title="Lista nije ucitana"
              description={errorMessage}
              actionLabel="Pokusaj ponovo"
              onAction={loadConnections}
            />
          </View>
        ) : users.length === 0 ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="people-outline"
              title={activeTab === 'followers' ? 'Jos nema pratilaca' : 'Jos ne pratis nikoga'}
              description="Kada se povezes sa ljudima, njihovi profili ce biti ovde dostupni za brz pregled."
            />
          </View>
        ) : (
          <View className="mt-5 gap-3">
            {users.map((connection) => {
              const name = connection.displayName || 'Korisnik'
              return (
                <TouchableOpacity
                  key={connection._id}
                  activeOpacity={0.88}
                  onPress={() => router.push(`/users/${connection._id}`)}
                  className="flex-row items-center rounded-[24px] bg-surface-panel px-4 py-4"
                >
                  {connection.photoURL ? (
                    <RemoteImage uri={connection.photoURL} className="h-14 w-14 rounded-full" />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-accent-light/35">
                      <Text className="font-display text-2xl text-brand-accent-deep">
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="font-sans text-sm font-semibold text-ink-dark">{name}</Text>
                    <Text className="mt-1 font-sans text-xs text-ink-dark/50" numberOfLines={1}>
                      {connection.location?.city
                        ? `${connection.location.city} - ${connection.completedTrades || 0} razmena`
                        : `${connection.completedTrades || 0} razmena`}
                    </Text>
                  </View>
                  {!connection.isSelf ? (
                    <TouchableOpacity
                      onPress={() => toggleFollow(connection)}
                      disabled={busyId === connection._id}
                      className={`rounded-full px-4 py-2.5 ${
                        connection.isFollowing ? 'bg-base-canvas' : 'bg-brand-accent-deep'
                      }`}
                    >
                      <Text
                        className={`font-sans text-xs font-semibold ${
                          connection.isFollowing ? 'text-ink-dark' : 'text-base-canvas'
                        }`}
                      >
                        {connection.isFollowing ? 'Pratis' : 'Zaprati'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
