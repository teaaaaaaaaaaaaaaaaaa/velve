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
  Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
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
  phoneVerified: boolean
  averageRating: number
  totalRatings: number
  completedTrades: number
  followersCount: number
  followingCount: number
  itemsCount: number
}

interface Item {
  _id: string
  title: string
  images: string[]
  price: number
  userId: string
}

export default function ProfileScreen() {
  const router = useRouter()
  const { currentUser, logout } = useAuth()

  const [profile, setProfile] = useState<User | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Edit profile state
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editPhotoURL, setEditPhotoURL] = useState('')

  const fetchProfile = async () => {
    try {
      const response = await client.get('/api/users/me')
      if (response.data.ok) {
        setProfile(response.data.data)
        setEditDisplayName(response.data.data.displayName)
        setEditBio(response.data.data.bio || '')
        setEditPhotoURL(response.data.data.photoURL)
      }
    } catch (error: any) {
      Alert.alert('Greška', error.response?.data?.message || 'Nije moguće učitati profil')
    }
  }

  const fetchItems = async () => {
    try {
      const response = await client.get('/api/items', {
        params: { userId: profile?._id },
      })
      if (response.data.ok) {
        setItems(response.data.data)
      }
    } catch (error: any) {
      Alert.alert('Greška', error.response?.data?.message || 'Nije moguće učitati predmete')
    }
  }

  const loadData = async () => {
    setLoading(true)
    await fetchProfile()
    setLoading(false)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    if (profile) {
      await fetchItems()
    }
    setRefreshing(false)
  }, [profile])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (profile) {
      fetchItems()
    }
  }, [profile])

  const handleLogout = async () => {
    Alert.alert('Odjavi se', 'Da li si siguran da želiš da se odjaviš?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Odjavi se',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout()
            router.replace('/(auth)/login')
          } catch (error: any) {
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
      await uploadImage(result.assets[0].uri)
    }
  }

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true)

      // Create form data
      const formData = new FormData()
      const filename = uri.split('/').pop() || 'avatar.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any)

      // Upload to server
      const response = await client.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.ok) {
        setEditPhotoURL(response.data.data.url)
      }
    } catch (error: any) {
      Alert.alert('Greška', error.response?.data?.message || 'Nije moguće uploadovati sliku')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) {
      Alert.alert('Greška', 'Ime ne može biti prazno')
      return
    }

    if (editDisplayName.length > 50) {
      Alert.alert('Greška', 'Ime može imati maksimalno 50 karaktera')
      return
    }

    if (editBio.length > 200) {
      Alert.alert('Greška', 'Bio može imati maksimalno 200 karaktera')
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
        setProfile(response.data.data)
        setModalVisible(false)
        Alert.alert('Uspeh', 'Profil je uspešno ažuriran')
      }
    } catch (error: any) {
      Alert.alert('Greška', error.response?.data?.message || 'Nije moguće ažurirati profil')
    } finally {
      setUploading(false)
    }
  }

  const handleItemPress = (itemId: string) => {
    router.push(`/items/${itemId}`)
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
        <Text className="font-display text-ink-dark text-xl mb-2">Greška</Text>
        <Text className="font-sans text-ink-dark opacity-60 text-center mb-6">
          Nije moguće učitati profil
        </Text>
        <TouchableOpacity
          onPress={loadData}
          className="bg-brand-accent-deep rounded-full py-4 px-6"
        >
          <Text className="font-sans text-base-canvas font-semibold">Pokušaj ponovo</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-base-canvas"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Header */}
        <View className="items-center pt-12 pb-6 px-6">
          {/* Avatar */}
          <View className="mb-4">
            {profile.photoURL ? (
              <Image
                source={{ uri: profile.photoURL }}
                className="w-20 h-20 rounded-full border-2 border-brand-accent-deep"
              />
            ) : (
              <View className="w-20 h-20 rounded-full border-2 border-brand-accent-deep bg-brand-accent-light items-center justify-center">
                <Text className="font-display text-brand-accent-deep text-2xl">
                  {profile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Display Name */}
          <Text className="font-display text-ink-dark text-xl mb-2">{profile.displayName}</Text>

          {/* Email with Verified Badge */}
          <View className="flex-row items-center mb-3">
            <Text className="font-sans text-ink-dark opacity-60 text-sm">{profile.email}</Text>
            {profile.emailVerified && (
              <View className="ml-2 bg-brand-highlight rounded-full px-2 py-0.5">
                <Text className="font-sans text-ink-dark text-xs font-semibold">✓</Text>
              </View>
            )}
          </View>

          {/* Bio */}
          {profile.bio && (
            <Text className="font-sans text-ink-dark text-center text-sm mb-4">
              {profile.bio}
            </Text>
          )}

          {/* Stats Row */}
          <View className="flex-row justify-around w-full mb-6">
            <TouchableOpacity className="items-center">
              <Text className="font-display text-ink-dark text-2xl">
                {profile.followersCount || 0}
              </Text>
              <Text className="font-sans text-ink-dark opacity-60 text-xs">Followers</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center">
              <Text className="font-display text-ink-dark text-2xl">
                {profile.followingCount || 0}
              </Text>
              <Text className="font-sans text-ink-dark opacity-60 text-xs">Following</Text>
            </TouchableOpacity>

            <View className="items-center">
              <Text className="font-display text-ink-dark text-2xl">
                {profile.itemsCount || 0}
              </Text>
              <Text className="font-sans text-ink-dark opacity-60 text-xs">Predmeti</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="flex-1 border border-ink-dark rounded-full py-3 px-4"
            >
              <Text className="font-sans text-ink-dark text-center font-semibold">
                Izmeni profil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              className="flex-1 border border-red-600 rounded-full py-3 px-4"
            >
              <Text className="font-sans text-red-600 text-center font-semibold">Odjavi se</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Items Grid */}
        <View className="px-4 pb-6">
          <Text className="font-display text-ink-dark text-lg mb-4">Moji predmeti</Text>

          {items.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center">
              <Text className="font-display text-ink-dark text-lg mb-2">Nemaš još predmeta</Text>
              <Text className="font-sans text-ink-dark opacity-60 text-sm text-center">
                Dodaj prvi predmet i počni sa razmenom!
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {items.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  onPress={() => handleItemPress(item._id)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                  style={{ width: '48%' }}
                >
                  {item.images && item.images.length > 0 ? (
                    <Image
                      source={{ uri: item.images[0] }}
                      className="w-full h-40"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-40 bg-brand-accent-light items-center justify-center">
                      <Text className="font-display text-brand-accent-deep text-4xl">?</Text>
                    </View>
                  )}
                  <View className="p-3">
                    <Text className="font-sans text-ink-dark font-semibold" numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-base-canvas">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center px-6 pt-12 pb-4 border-b border-ink-dark/10">
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="font-sans text-ink-dark text-base">Otkaži</Text>
            </TouchableOpacity>
            <Text className="font-display text-ink-dark text-lg">Izmeni profil</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={uploading}>
              <Text
                className={`font-sans text-base font-semibold ${
                  uploading ? 'text-ink-dark/40' : 'text-brand-accent-deep'
                }`}
              >
                {uploading ? 'Čuvam...' : 'Sačuvaj'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6">
            {/* Avatar Section */}
            <View className="items-center mb-8">
              {editPhotoURL ? (
                <Image
                  source={{ uri: editPhotoURL }}
                  className="w-24 h-24 rounded-full border-2 border-brand-accent-deep mb-4"
                />
              ) : (
                <View className="w-24 h-24 rounded-full border-2 border-brand-accent-deep bg-brand-accent-light items-center justify-center mb-4">
                  <Text className="font-display text-brand-accent-deep text-3xl">
                    {editDisplayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploading}
                className="bg-brand-accent-deep rounded-full py-2 px-4"
              >
                <Text className="font-sans text-base-canvas text-sm font-semibold">
                  {uploading ? 'Uploadujem...' : 'Promeni sliku'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display Name Input */}
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
              <Text className="font-sans text-ink-dark opacity-40 text-xs mt-1">
                {editDisplayName.length}/50
              </Text>
            </View>

            {/* Bio Input */}
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
              <Text className="font-sans text-ink-dark opacity-40 text-xs mt-1">
                {editBio.length}/200
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
