import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

interface User {
  _id: string
  firebaseUid: string
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
  stylePreferences?: string[]
  categories?: string[]
  favoriteBrands?: string[]
  sizes?: { clothing?: string; shoes?: string }
  location?: { city?: string; region?: string }
}

interface Item {
  _id: string
  title: string
  images: string[]
  brand?: string
  size?: string
  userId?: string
  status?: string
  archivedReason?: 'deleted' | 'sold'
}

type ProfileTab = 'items' | 'saved' | 'liked' | 'archive'

function calculateCompleteness(profile: User | null): number {
  if (!profile) return 0

  let score = 0

  // Core profile (40%)
  score += 13.3 // displayName always filled
  if (profile.photoURL) score += 13.3
  if (profile.bio && profile.bio.length > 0) score += 13.3

  // Preferences (60%)
  if (profile.stylePreferences && profile.stylePreferences.length > 0) score += 10
  if (profile.categories && profile.categories.length > 0) score += 10
  if (profile.favoriteBrands && profile.favoriteBrands.length > 0) score += 10
  if (profile.sizes?.clothing) score += 10
  if (profile.sizes?.shoes) score += 10
  if (profile.location?.city) score += 10

  return Math.round(score)
}

export default function ProfileScreen() {
  const router = useRouter()
  const { currentUser, logout } = useAuth()

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('items')

  const [myItems, setMyItems] = useState<Item[]>([])
  const [savedItems, setSavedItems] = useState<Item[]>([])
  const [likedItems, setLikedItems] = useState<Item[]>([])
  const [archivedItems, setArchivedItems] = useState<Item[]>([])

  const [itemsLoading, setItemsLoading] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [likedLoading, setLikedLoading] = useState(false)
  const [archivedLoading, setArchivedLoading] = useState(false)

  const [modalVisible, setModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPhotoURL, setEditPhotoURL] = useState('')

  const fetchProfile = async () => {
    try {
      const response = await client.get('/api/users/me')
      if (response.data.ok) {
        const data = response.data.data
        setProfile(data)
        setEditDisplayName(data.displayName)
        setEditBio(data.bio || '')
        setEditPhotoURL(data.photoURL)
        return data
      }
    } catch (error: any) {
      Alert.alert('Greška', error.response?.data?.message || 'Nije moguće učitati profil')
    }
    return null
  }

  const fetchMyItems = async (profileData: User) => {
    try {
      setItemsLoading(true)
      const response = await client.get('/api/items', {
        params: { userId: profileData._id },
      })
      if (response.data.ok) {
        setMyItems(response.data.data)
      }
    } catch {}
    finally { setItemsLoading(false) }
  }

  const fetchSaved = async () => {
    try {
      setSavedLoading(true)
      const response = await client.get('/api/wishlist')
      if (response.data.ok) {
        setSavedItems(
          response.data.data
            .filter((w: any) => w.itemId)
            .map((w: any) => w.itemId)
        )
      }
    } catch {}
    finally { setSavedLoading(false) }
  }

  const fetchLiked = async () => {
    try {
      setLikedLoading(true)
      const response = await client.get('/api/likes')
      if (response.data.ok) {
        setLikedItems(response.data.data)
      }
    } catch {}
    finally { setLikedLoading(false) }
  }

  const fetchArchivedItems = async (profileData: User) => {
    try {
      setArchivedLoading(true)
      const response = await client.get('/api/items', {
        params: { userId: profileData._id, archived: true },
      })
      if (response.data.ok) {
        setArchivedItems(response.data.data)
      }
    } catch {}
    finally { setArchivedLoading(false) }
  }

  const loadAll = async () => {
    setLoading(true)
    const profileData = await fetchProfile()
    if (profileData) {
      await Promise.all([
        fetchMyItems(profileData),
        fetchSaved(),
        fetchLiked(),
        fetchArchivedItems(profileData),
      ])
    }
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [])

  const handleLogout = async () => {
    Alert.alert('Odjavi se', 'Da li si sigurna?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Odjavi se',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout()
            router.replace('/(auth)/login')
          } catch {
            Alert.alert('Greška', 'Nije moguće odjaviti se')
          }
        },
      },
    ])
  }

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup galeriji')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri)
    }
  }

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true)
      const formData = new FormData()
      const filename = uri.split('/').pop() || 'avatar.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'
      formData.append('image', { uri, name: filename, type } as any)
      const response = await client.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (response.data.ok) setEditPhotoURL(response.data.data.url)
    } catch {
      Alert.alert('Greška', 'Nije moguće uploadovati sliku')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) return Alert.alert('Greška', 'Ime ne može biti prazno')
    if (editDisplayName.length > 50) return Alert.alert('Greška', 'Ime max 50 karaktera')
    if (editBio.length > 200) return Alert.alert('Greška', 'Bio max 200 karaktera')
    try {
      setUploading(true)
      const response = await client.put('/api/users/me', {
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        photoURL: editPhotoURL,
      })
      if (response.data.ok) {
        setProfile(response.data.data)
        setModalVisible(false)
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće ažurirati profil')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSaved = async (itemId: string) => {
    try {
      await client.delete(`/api/wishlist/${itemId}`)
      setSavedItems((prev) => prev.filter((i) => i._id !== itemId))
    } catch {
      Alert.alert('Greška', 'Nije moguće ukloniti iz sačuvanih')
    }
  }

  const handleUnlike = async (itemId: string) => {
    try {
      await client.delete(`/api/items/${itemId}/like`)
      setLikedItems((prev) => prev.filter((i) => i._id !== itemId))
    } catch {
      Alert.alert('Greška', 'Greška pri uklanjanju lajka')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-base-canvas justify-center items-center">
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-base-canvas justify-center items-center px-6">
        <Text className="font-display text-ink-dark text-xl mb-6">Nije moguće učitati profil</Text>
        <TouchableOpacity onPress={loadAll} className="bg-brand-accent-deep rounded-full py-4 px-6">
          <Text className="font-sans text-base-canvas font-semibold">Pokušaj ponovo</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const tabData: Item[] =
    activeTab === 'items'
      ? myItems
      : activeTab === 'saved'
      ? savedItems
      : activeTab === 'liked'
      ? likedItems
      : archivedItems

  const tabLoading =
    activeTab === 'items'
      ? itemsLoading
      : activeTab === 'saved'
      ? savedLoading
      : activeTab === 'liked'
      ? likedLoading
      : archivedLoading

  return (
    <>
      <FlatList
        data={tabData}
        keyExtractor={(item) => item._id}
        numColumns={2}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Profile Header */}
            <View className="items-center pt-12 pb-6 px-6">
              <TouchableOpacity onPress={() => setModalVisible(true)} className="mb-4">
                {profile.photoURL ? (
                  <Image
                    source={{ uri: profile.photoURL }}
                    className="w-20 h-20 rounded-full border-2 border-brand-accent-deep"
                  />
                ) : (
                  <View className="w-20 h-20 rounded-full border-2 border-brand-accent-deep bg-brand-accent-light items-center justify-center">
                    <Text className="font-display text-brand-accent-deep text-2xl">
                      {profile.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text className="font-display text-ink-dark text-xl mb-1">{profile.displayName}</Text>
              <Text className="font-sans text-ink-dark opacity-50 text-sm mb-2">{profile.email}</Text>

              {profile.bio ? (
                <Text className="font-sans text-ink-dark text-center text-sm mb-4">{profile.bio}</Text>
              ) : null}

              {/* Profile Completeness */}
              {profile && calculateCompleteness(profile) < 100 && (
                <View className="w-full px-6 mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-ink-dark text-sm font-medium font-sans">
                      Kompletnost profila
                    </Text>
                    <Text className="text-brand-accent-deep text-sm font-bold font-sans">
                      {calculateCompleteness(profile)}%
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View className="w-full h-2 bg-brand-accent-light/30 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-brand-accent-deep rounded-full"
                      style={{ width: `${calculateCompleteness(profile)}%` }}
                    />
                  </View>

                  {/* CTA */}
                  <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="mt-2"
                  >
                    <Text className="text-brand-accent-deep text-xs font-sans">
                      Završi profil za bolje preporuke
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Stats */}
              <View className="flex-row justify-around w-full mb-5">
                <View className="items-center">
                  <Text className="font-display text-ink-dark text-2xl">{profile.followersCount || 0}</Text>
                  <Text className="font-sans text-ink-dark opacity-50 text-xs">Followers</Text>
                </View>
                <View className="items-center">
                  <Text className="font-display text-ink-dark text-2xl">{profile.followingCount || 0}</Text>
                  <Text className="font-sans text-ink-dark opacity-50 text-xs">Following</Text>
                </View>
                <View className="items-center">
                  <Text className="font-display text-ink-dark text-2xl">{myItems.length}</Text>
                  <Text className="font-sans text-ink-dark opacity-50 text-xs">Predmeti</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setModalVisible(true)}
                  className="flex-1 border border-ink-dark rounded-full py-3 px-4"
                >
                  <Text className="font-sans text-ink-dark text-center font-semibold">Izmeni profil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  className="flex-1 border border-red-600 rounded-full py-3 px-4"
                >
                  <Text className="font-sans text-red-600 text-center font-semibold">Odjavi se</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
              {(['items', 'saved', 'liked', 'archive'] as ProfileTab[]).map((tab) => {
                const labels: Record<ProfileTab, string> = {
                  items: 'Moji predmeti',
                  saved: 'Sačuvano',
                  liked: 'Lajkovano',
                  archive: 'Arhiva',
                }
                const icons: Record<ProfileTab, string> = {
                  items: 'shirt-outline',
                  saved: 'bookmark-outline',
                  liked: 'heart-outline',
                  archive: 'archive-outline',
                }
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={icons[tab] as any}
                      size={16}
                      color={activeTab === tab ? '#431A43' : '#2B2A2B80'}
                    />
                    <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                      {labels[tab]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {tabLoading && (
              <View className="py-12 items-center">
                <ActivityIndicator size="small" color="#431A43" />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          tabLoading ? null : (
            <View className="py-12 items-center px-6">
              <Text className="font-display text-ink-dark text-base opacity-40 text-center">
                {activeTab === 'items'
                  ? 'Nemaš još predmeta'
                  : activeTab === 'saved'
                  ? 'Nemaš sačuvanih itema'
                  : activeTab === 'liked'
                  ? 'Nisi lajkovala nijedan item'
                  : 'Arhiva je prazna'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ItemTile
            item={item}
            tab={activeTab}
            onPress={() =>
              router.push(
                `/items/${item._id}?viewOnly=${activeTab === 'items' || activeTab === 'archive'}`
              )
            }
            onRemove={
              activeTab === 'saved'
                ? () => handleRemoveSaved(item._id)
                : activeTab === 'liked'
                ? () => handleUnlike(item._id)
                : undefined
            }
            archived={activeTab === 'archive'}
            archiveStatus={
              activeTab === 'archive'
                ? item.status === 'sold'
                  ? 'sold'
                  : 'deleted'
                : undefined
            }
          />
        )}
      />

      {/* Edit Profile Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-base-canvas">
          <View className="flex-row justify-between items-center px-6 pt-12 pb-4 border-b border-ink-dark/10">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="font-sans text-ink-dark text-base">Otkaži</Text>
            </TouchableOpacity>
            <Text className="font-display text-ink-dark text-lg">Izmeni profil</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={uploading}>
              <Text className={`font-sans text-base font-semibold ${uploading ? 'text-ink-dark/40' : 'text-brand-accent-deep'}`}>
                {uploading ? 'Čuvam...' : 'Sačuvaj'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6">
            <View className="items-center mb-8">
              {editPhotoURL ? (
                <Image source={{ uri: editPhotoURL }} className="w-24 h-24 rounded-full border-2 border-brand-accent-deep mb-4" />
              ) : (
                <View className="w-24 h-24 rounded-full border-2 border-brand-accent-deep bg-brand-accent-light items-center justify-center mb-4">
                  <Text className="font-display text-brand-accent-deep text-3xl">{editDisplayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <TouchableOpacity onPress={handlePickImage} disabled={uploading} className="bg-brand-accent-deep rounded-full py-2 px-4">
                <Text className="font-sans text-base-canvas text-sm font-semibold">
                  {uploading ? 'Uploadujem...' : 'Promeni sliku'}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-6">
              <Text className="font-sans text-ink-dark text-sm mb-2">Ime</Text>
              <TextInput
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                maxLength={50}
                className="bg-white border border-ink-dark/20 rounded-xl px-4 py-3 font-sans text-ink-dark"
                placeholder="Tvoje ime"
                placeholderTextColor="#2B2A2B66"
              />
              <Text className="font-sans text-ink-dark opacity-40 text-xs mt-1">{editDisplayName.length}/50</Text>
            </View>

            <View className="mb-6">
              <Text className="font-sans text-ink-dark text-sm mb-2">Bio</Text>
              <TextInput
                value={editBio}
                onChangeText={setEditBio}
                maxLength={200}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="bg-white border border-ink-dark/20 rounded-xl px-4 py-3 font-sans text-ink-dark"
                placeholder="Napiši nešto o sebi..."
                placeholderTextColor="#2B2A2B66"
              />
              <Text className="font-sans text-ink-dark opacity-40 text-xs mt-1">{editBio.length}/200</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

function ItemTile({
  item,
  tab,
  onPress,
  onRemove,
  archived,
  archiveStatus,
}: {
  item: Item
  tab: ProfileTab
  onPress: () => void
  onRemove?: () => void
  archived?: boolean
  archiveStatus?: 'deleted' | 'sold'
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tile}
      activeOpacity={0.8}
    >
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <View style={[styles.tileImage, styles.tileImagePlaceholder]}>
          <Ionicons name="shirt-outline" size={32} color="#9DD3E4" />
        </View>
      )}

      {/* Archive badge */}
      {archived && archiveStatus && (
        <View
          style={[
            styles.archiveBadge,
            archiveStatus === 'sold' ? styles.archiveBadgeSold : styles.archiveBadgeDeleted,
          ]}
        >
          <Text style={styles.archiveBadgeText}>
            {archiveStatus === 'sold' ? 'Prodato' : 'Obrisano'}
          </Text>
        </View>
      )}

      <View style={styles.tileMeta}>
        <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
      </View>
      {onRemove && (
        <TouchableOpacity style={styles.tileRemoveBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={tab === 'saved' ? 'bookmark' : 'heart'}
            size={18}
            color="#431A43"
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40,
  },
  row: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 3,
  },
  tabBtnActive: {
    backgroundColor: '#F6F8ED',
  },
  tabLabel: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: '#2B2A2B80',
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#431A43',
    fontWeight: '700',
  },
  tile: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    aspectRatio: 0.85,
  },
  tileImagePlaceholder: {
    backgroundColor: '#E8F7FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileMeta: {
    padding: 10,
  },
  tileTitle: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#2B2A2B',
    fontWeight: '600',
  },
  tileRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  archiveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  archiveBadgeSold: {
    backgroundColor: '#CBDA63',
  },
  archiveBadgeDeleted: {
    backgroundColor: '#FF3B5C',
  },
  archiveBadgeText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
    color: '#2B2A2B',
  },
})
