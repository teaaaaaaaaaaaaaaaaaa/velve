import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
}

interface ItemOwner {
  _id: string
  displayName: string
  photoURL: string
}

interface Item {
  _id: string
  title: string
  description: string
  category: string
  brand: string
  size: string
  condition: 'new' | 'like_new' | 'good' | 'fair'
  images: string[]
  userId: ItemOwner | string
  createdAt: string
  likesCount?: number
  isLiked?: boolean
  isWishlisted?: boolean
}

interface UserItem {
  _id: string
  title: string
  images: string[]
  brand: string
}

export default function ItemDetailsScreen() {
  const { id, viewOnly, openTrade } = useLocalSearchParams<{ id: string; viewOnly?: string; openTrade?: string }>()
  const isViewOnly = viewOnly === 'true'
  const router = useRouter()
  const { dbUser } = useAuth()

  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const [showTradeModal, setShowTradeModal] = useState(false)
  const [currentUserItems, setUserItems] = useState<UserItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [tradeMessage, setTradeMessage] = useState('')
  const [loadingUserItems, setLoadingUserItems] = useState(false)
  const [submittingTrade, setSubmittingTrade] = useState(false)

  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    fetchItemDetails()
  }, [id])

  useEffect(() => {
    if (!loading && openTrade === 'true' && item) {
      setShowTradeModal(true)
      fetchUserItems()
    }
  }, [loading, openTrade, item])

  const fetchItemDetails = async () => {
    try {
      setLoading(true)
      const response = await client.get(`/api/items/${id}`)
      if (response.data.ok) {
        const data = response.data.data
        setItem(data)
        setIsLiked(data.isLiked || false)
        setLikesCount(data.likesCount || 0)
        setIsWishlisted(data.isWishlisted || false)
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće učitati detalje itema')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const fetchUserItems = async () => {
    if (!dbUser) return
    try {
      setLoadingUserItems(true)
      const response = await client.get(`/api/items?userId=${dbUser._id}`)
      if (response.data.ok) {
        setUserItems(response.data.data.filter((i: UserItem) => i._id !== id))
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće učitati tvoje iteme')
    } finally {
      setLoadingUserItems(false)
    }
  }

  const handleLike = async () => {
    try {
      const response = await client.post(`/api/items/${id}/like`)
      if (response.data.ok) {
        setIsLiked(response.data.isLiked)
        setLikesCount(response.data.likesCount)
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće lajkovati item')
    }
  }

  const handleWishlist = async () => {
    try {
      if (isWishlisted) {
        await client.delete(`/api/wishlist/${id}`)
        setIsWishlisted(false)
      } else {
        await client.post(`/api/wishlist/${id}`)
        setIsWishlisted(true)
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće dodati u wishlist')
    }
  }

  const handleDelete = () => {
    Alert.alert('Obriši predmet', 'Da li si sigurna?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Obriši',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/api/items/${id}`)
            router.back()
          } catch {
            Alert.alert('Greška', 'Nije moguće obrisati predmet')
          }
        },
      },
    ])
  }

  const handleSubmitTrade = async () => {
    if (!selectedItemId) {
      Alert.alert('Greška', 'Izaberi item za razmenu')
      return
    }
    try {
      setSubmittingTrade(true)
      const response = await client.post('/api/trades', {
        offeredItemId: selectedItemId,
        requestedItemId: id,
        message: tradeMessage.trim() || undefined,
      })
      if (response.data.ok) {
        const chatId = response.data.data?.chatId
        setShowTradeModal(false)
        Alert.alert('Uspeh', 'Zahtev za razmenu je poslat!', [
          {
            text: 'Otvori chat',
            onPress: () => router.push(chatId ? `/(tabs)/chat/${chatId}` : '/(tabs)/chat'),
          },
        ])
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće poslati zahtev')
    } finally {
      setSubmittingTrade(false)
    }
  }

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setCurrentImageIndex(index)
  }

  const isOwn = () => {
    if (!dbUser || !item) return false
    const ownerId = typeof item.userId === 'object' ? item.userId._id : item.userId
    return ownerId === dbUser._id
  }

  const owner = item && typeof item.userId === 'object' ? item.userId : null

  if (loading || !item) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  const metaParts = [
    item.brand,
    item.size ? item.size.toUpperCase() : null,
    CONDITION_LABELS[item.condition],
  ].filter(Boolean)

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Full screen image gallery */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {item.images.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Image dots */}
      {item.images.length > 1 && (
        <View style={styles.dots}>
          {item.images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentImageIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={22} color="white" />
      </TouchableOpacity>

      {/* Top info: title + meta */}
      <View style={styles.topInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.itemMeta}>{metaParts.join('  ·  ')}</Text>
      </View>

      {/* Bottom info: user + description */}
      <View style={styles.bottomInfo}>
        {owner && (
          <View style={styles.userRow}>
            <Image
              source={{ uri: owner.photoURL || '' }}
              style={styles.avatar}
            />
            <Text style={styles.userName}>@{owner.displayName}</Text>
          </View>
        )}
        {!!item.description && (
          <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        )}
      </View>

      {/* Right side actions — only when NOT viewOnly */}
      {!isViewOnly && (
        <View style={styles.sideActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.8}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={34}
              color={isLiked ? '#FF3B5C' : 'white'}
            />
            <Text style={styles.actionCount}>{likesCount}</Text>
          </TouchableOpacity>

          {!isOwn() && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleWishlist} activeOpacity={0.8}>
              <Ionicons
                name={isWishlisted ? 'bookmark' : 'bookmark-outline'}
                size={32}
                color={isWishlisted ? '#CBDA63' : 'white'}
              />
              <Text style={styles.actionLabel}>Sačuvaj</Text>
            </TouchableOpacity>
          )}

          {!isOwn() && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/(tabs)/chat')}
              activeOpacity={0.8}
            >
              <Ionicons name="paper-plane-outline" size={32} color="white" />
              <Text style={styles.actionLabel}>Poruka</Text>
            </TouchableOpacity>
          )}

          {isOwn() ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={22} color="white" />
              <Text style={styles.actionLabel}>Obriši</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.tradeBtn}
              onPress={() => { setShowTradeModal(true); fetchUserItems() }}
              activeOpacity={0.8}
            >
              <Text style={styles.tradeBtnText}>Razmeni</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Trade Modal */}
      <Modal
        visible={showTradeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTradeModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#F6F8ED' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTradeModal(false)}>
              <Ionicons name="close" size={28} color="#2B2A2B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Predloži razmenu</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 24 }}>
            <Text style={styles.modalHint}>Izaberi jedan od tvojih itema:</Text>

            {loadingUserItems && (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#431A43" />
              </View>
            )}

            {!loadingUserItems && currentUserItems.length === 0 && (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <Ionicons name="shirt-outline" size={64} color="#2B2A2B" opacity={0.3} />
                <Text style={styles.modalEmpty}>Nemaš iteme za razmenu.{'\n'}Dodaj svoje iteme prvo!</Text>
              </View>
            )}

            {!loadingUserItems && currentUserItems.map((ui) => (
              <TouchableOpacity
                key={ui._id}
                onPress={() => setSelectedItemId(ui._id)}
                style={[
                  styles.userItemRow,
                  selectedItemId === ui._id && styles.userItemRowSelected,
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, selectedItemId === ui._id && styles.radioSelected]}>
                  {selectedItemId === ui._id && <View style={styles.radioDot} />}
                </View>
                <Image source={{ uri: ui.images[0] }} style={styles.userItemImg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userItemTitle}>{ui.title}</Text>
                  <Text style={styles.userItemBrand}>{ui.brand}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {currentUserItems.length > 0 && (
              <View style={{ marginTop: 24, marginBottom: 8 }}>
                <Text style={styles.modalHint}>Poruka (opciono)</Text>
                <TextInput
                  value={tradeMessage}
                  onChangeText={setTradeMessage}
                  placeholder="Dodaj poruku..."
                  placeholderTextColor="#2B2A2B60"
                  multiline
                  maxLength={300}
                  style={styles.tradeMessageInput}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{tradeMessage.length}/300</Text>
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          {currentUserItems.length > 0 && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleSubmitTrade}
                disabled={!selectedItemId || submittingTrade}
                style={[
                  styles.submitBtn,
                  (!selectedItemId || submittingTrade) && { opacity: 0.4 },
                ]}
                activeOpacity={0.8}
              >
                {submittingTrade ? (
                  <ActivityIndicator size="small" color="#F6F8ED" />
                ) : (
                  <Text style={styles.submitBtnText}>Pošalji zahtev</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.85)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loading: {
    flex: 1,
    backgroundColor: '#F6F8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: 'white',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInfo: {
    position: 'absolute',
    top: 52,
    left: 64,
    right: 84,
  },
  itemTitle: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'AlteHaasGrotesk-Bold',
    marginBottom: 6,
    ...shadow,
  },
  itemMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter',
    ...shadow,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 88,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    marginRight: 8,
  },
  userName: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '700',
    ...shadow,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter',
    lineHeight: 19,
    ...shadow,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: '700',
    marginTop: 3,
    ...shadow,
  },
  actionLabel: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Inter',
    marginTop: 3,
    ...shadow,
  },
  deleteBtn: {
    alignItems: 'center',
  },
  tradeBtn: {
    backgroundColor: '#431A43',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  tradeBtnText: {
    color: '#F6F8ED',
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: '700',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(43,42,43,0.1)',
  },
  modalTitle: {
    fontFamily: 'AlteHaasGrotesk-Bold',
    fontSize: 18,
    color: '#2B2A2B',
  },
  modalHint: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#2B2A2B',
    marginBottom: 12,
    marginTop: 16,
  },
  modalEmpty: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#2B2A2B',
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.6,
  },
  userItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(43,42,43,0.1)',
    marginBottom: 10,
  },
  userItemRowSelected: {
    borderColor: '#431A43',
    backgroundColor: 'rgba(67,26,67,0.05)',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(43,42,43,0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#431A43',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#431A43',
  },
  userItemImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  userItemTitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#2B2A2B',
    fontWeight: '600',
  },
  userItemBrand: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: 'rgba(43,42,43,0.6)',
    marginTop: 2,
  },
  tradeMessageInput: {
    borderWidth: 1,
    borderColor: 'rgba(43,42,43,0.2)',
    borderRadius: 16,
    padding: 14,
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#2B2A2B',
    minHeight: 100,
    backgroundColor: 'white',
  },
  charCount: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: 'rgba(43,42,43,0.5)',
    textAlign: 'right',
    marginTop: 4,
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(43,42,43,0.1)',
  },
  submitBtn: {
    backgroundColor: '#431A43',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#F6F8ED',
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
  },
})
