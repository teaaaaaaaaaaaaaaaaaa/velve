import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getApiErrorMessage } from '@/lib/apiErrors'

type BlockedUserEntry = {
  _id: string
  createdAt: string
  reason?: string
  user: {
    _id: string
    displayName?: string
    photoURL?: string
    bio?: string
    completedTrades?: number
    averageRating?: number
  }
}

export default function BlockedUsersScreen() {
  const router = useRouter()
  const [entries, setEntries] = useState<BlockedUserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const loadBlockedUsers = useCallback(async () => {
    try {
      const response = await client.get('/api/users/me/blocked-users')
      if (response.data.ok) {
        setEntries(response.data.data || [])
        setErrorMessage('')
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Lista blokiranih korisnika trenutno nije dostupna.'))
    }
  }, [])

  useEffect(() => {
    loadBlockedUsers().finally(() => setLoading(false))
  }, [loadBlockedUsers])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadBlockedUsers()
    setRefreshing(false)
  }, [loadBlockedUsers])

  const unblockUser = useCallback(
    (entry: BlockedUserEntry) => {
      Alert.alert('Deblokiraj korisnika', `${entry.user.displayName || 'Korisnik'} ce ponovo moci da vidi tvoj profil i objave.`, [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Deblokiraj',
          onPress: async () => {
            try {
              setBusyId(entry.user._id)
              setEntries((prev) => prev.filter((item) => item.user._id !== entry.user._id))
              await client.delete(`/api/users/${entry.user._id}/block`)
            } catch (error) {
              Alert.alert('Greska', getApiErrorMessage(error, 'Deblokiranje trenutno nije uspelo.'))
              await loadBlockedUsers()
            } finally {
              setBusyId(null)
            }
          },
        },
      ])
    },
    [loadBlockedUsers]
  )

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
          Privacy
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">Blokirani korisnici</Text>
        <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/60">
          Ljudi koje blokiras ne ulaze u tvoj feed, search i trade tokove.
        </Text>

        {errorMessage ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="cloud-offline-outline"
              title="Lista nije ucitana"
              description={errorMessage}
              actionLabel="Pokusaj ponovo"
              onAction={loadBlockedUsers}
            />
          </View>
        ) : entries.length === 0 ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="shield-checkmark-outline"
              title="Nema blokiranih korisnika"
              description="Ako nekoga blokiras iz profila ili feeda, pojaviće se ovde."
            />
          </View>
        ) : (
          <View className="mt-6 gap-3">
            {entries.map((entry) => {
              const name = entry.user.displayName || 'Korisnik'
              return (
                <View key={entry._id} className="flex-row items-center rounded-[24px] bg-surface-panel px-4 py-4">
                  {entry.user.photoURL ? (
                    <RemoteImage uri={entry.user.photoURL} className="h-14 w-14 rounded-full" />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-accent-light/35">
                      <Text className="font-display text-2xl text-brand-accent-deep">
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="font-sans text-sm font-semibold text-ink-dark">{name}</Text>
                    <Text className="mt-1 font-sans text-xs text-ink-dark/50">
                      {entry.user.completedTrades || 0} razmena
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => unblockUser(entry)}
                    disabled={busyId === entry.user._id}
                    className="rounded-full bg-base-canvas px-4 py-2.5"
                  >
                    <Text className="font-sans text-xs font-semibold text-ink-dark">
                      {busyId === entry.user._id ? '...' : 'Deblokiraj'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
