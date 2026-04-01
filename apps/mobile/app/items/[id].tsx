import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import client from '@/api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ItemOwner {
  _id: string;
  displayName: string;
  photoURL: string;
}

interface Item {
  _id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  images: string[];
  userId: ItemOwner | string;
  createdAt: string;
  isLiked?: boolean;
  isWishlisted?: boolean;
}

interface UserItem {
  _id: string;
  title: string;
  images: string[];
  brand: string;
}

const CONDITION_LABELS = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'Zadovoljavajuće',
};

const CONDITION_COLORS = {
  new: 'bg-brand-highlight',
  like_new: 'bg-brand-accent-light',
  good: 'bg-brand-accent-light',
  fair: 'bg-brand-accent-light',
};

export default function ItemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log('[ItemDetailsScreen] Rendering, id:', id);
  const router = useRouter();
  const { currentUser } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Trade Request Modal
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentUserItems, setUserItems] = useState<UserItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [loadingUserItems, setLoadingUserItems] = useState(false);
  const [submittingTrade, setSubmittingTrade] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchItemDetails();
  }, [id]);

  const fetchItemDetails = async () => {
    console.log('[ItemDetailsScreen] fetchItemDetails called, id:', id);
    try {
      setLoading(true);
      const response = await client.get(`/api/items/${id}`);

      if (response.data.ok) {
        const itemData = response.data.data;
        setItem(itemData);
        setIsLiked(itemData.isLiked || false);
        setIsWishlisted(itemData.isWishlisted || false);
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Greška', 'Nije moguće učitati detalje itema');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchUserItems = async () => {
    if (!currentUser) return;

    try {
      setLoadingUserItems(true);
      const response = await client.get(`/api/items?userId=${currentUser.uid}`);

      if (response.data.ok) {
        // Filter out the current item from user's items
        const filteredItems = response.data.data.filter(
          (userItem: UserItem) => userItem._id !== id
        );
        setUserItems(filteredItems);
      }
    } catch (error) {
      console.error('Error fetching user items:', error);
      Alert.alert('Greška', 'Nije moguće učitati tvoje iteme');
    } finally {
      setLoadingUserItems(false);
    }
  };

  const handleLike = async () => {
    try {
      const response = await client.post(`/api/items/${id}/like`);

      if (response.data.ok) {
        setIsLiked(!isLiked);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Greška', 'Nije moguće lajkovati item');
    }
  };

  const handleWishlist = async () => {
    try {
      if (isWishlisted) {
        await client.delete(`/api/wishlist/${id}`);
        setIsWishlisted(false);
      } else {
        await client.post(`/api/wishlist/${id}`);
        setIsWishlisted(true);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Alert.alert('Greška', 'Nije moguće dodati u wishlist');
    }
  };

  const handleOpenTradeModal = async () => {
    setShowTradeModal(true);
    await fetchUserItems();
  };

  const handleSubmitTrade = async () => {
    if (!selectedItemId) {
      Alert.alert('Greška', 'Molimo izaberi item za razmenu');
      return;
    }

    if (tradeMessage.length > 300) {
      Alert.alert('Greška', 'Poruka ne može biti duža od 300 karaktera');
      return;
    }

    try {
      setSubmittingTrade(true);
      const response = await client.post('/api/trades', {
        offeredItemId: selectedItemId,
        requestedItemId: id,
        message: tradeMessage.trim() || undefined,
      });

      if (response.data.ok) {
        setShowTradeModal(false);
        Alert.alert(
          'Uspeh',
          'Zahtev za razmenu je poslat!',
          [
            {
              text: 'OK',
              onPress: () => router.push('/(tabs)/chat'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error submitting trade:', error);
      Alert.alert('Greška', 'Nije moguće poslati zahtev za razmenu');
    } finally {
      setSubmittingTrade(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  if (loading || !item) {
    return (
      <View className="flex-1 bg-base-canvas">
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: '',
            headerTransparent: true,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                className="ml-4 bg-white rounded-full p-2"
              >
                <Ionicons name="arrow-back" size={24} color="#2B2A2B" />
              </TouchableOpacity>
            ),
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#431A43" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerTransparent: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              className="ml-4 bg-white rounded-full p-2"
            >
              <Ionicons name="arrow-back" size={24} color="#2B2A2B" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View className="bg-white rounded-b-3xl" style={{ height: Dimensions.get('window').height * 0.75 }}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {item.images.map((imageUrl, index) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={{ width: SCREEN_WIDTH, height: '100%' }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Dots Indicator */}
          <View className="absolute bottom-6 left-0 right-0 flex-row justify-center">
            {item.images.map((_, index) => (
              <View
                key={index}
                className={`w-2 h-2 rounded-full mx-1 ${
                  index === currentImageIndex ? 'bg-brand-accent-deep' : 'bg-white opacity-50'
                }`}
              />
            ))}
          </View>
        </View>

        {/* Item Details */}
        <View className="px-6 py-6">
          {/* Title */}
          <Text className="font-display text-2xl text-ink-dark mb-4">
            {item.title}
          </Text>

          {/* Owner Info */}
          {item.userId && typeof item.userId === 'object' && (
            <TouchableOpacity
              className="flex-row items-center mb-6"
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: item.userId.photoURL || 'https://via.placeholder.com/40' }}
                className="w-10 h-10 rounded-full mr-3"
              />
              <Text className="font-sans text-base text-ink-dark">
                {item.userId.displayName}
              </Text>
            </TouchableOpacity>
          )}

          {/* Details Row */}
          <View className="flex-row flex-wrap mb-6">
            {/* Brand */}
            <View className="flex-row items-center mr-6 mb-3">
              <Ionicons name="pricetag-outline" size={18} color="#2B2A2B" />
              <Text className="font-sans text-sm text-ink-dark ml-2">
                {item.brand}
              </Text>
            </View>

            {/* Size */}
            <View className="flex-row items-center mr-6 mb-3">
              <Ionicons name="resize-outline" size={18} color="#2B2A2B" />
              <Text className="font-sans text-sm text-ink-dark ml-2">
                {item.size}
              </Text>
            </View>

            {/* Condition */}
            <View className="flex-row items-center mb-3">
              <View className={`${CONDITION_COLORS[item.condition]} rounded-full px-3 py-1`}>
                <Text className="font-sans text-xs text-ink-dark font-medium">
                  {CONDITION_LABELS[item.condition]}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="font-sans text-sm text-ink-dark font-medium mb-2">
              Opis
            </Text>
            <Text className="font-sans text-sm text-ink-dark leading-6">
              {item.description}
            </Text>
          </View>

          {/* Category */}
          <View className="mb-6">
            <Text className="font-sans text-sm text-ink-dark font-medium mb-2">
              Kategorija
            </Text>
            <Text className="font-sans text-sm text-ink-dark">
              {item.category}
            </Text>
          </View>
        </View>

        {/* Bottom spacing for fixed action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-base-canvas border-t border-ink-dark/10 px-6 py-4">
        <View className="flex-row items-center">
          {/* Like Button */}
          <TouchableOpacity
            onPress={handleLike}
            className="border border-ink-dark rounded-full p-3 mr-3"
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#431A43' : '#2B2A2B'}
            />
          </TouchableOpacity>

          {/* Wishlist Button */}
          <TouchableOpacity
            onPress={handleWishlist}
            className="border border-ink-dark rounded-full p-3 mr-3"
            activeOpacity={0.7}
          >
            <Ionicons
              name={isWishlisted ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isWishlisted ? '#431A43' : '#2B2A2B'}
            />
          </TouchableOpacity>

          {/* Trade Button */}
          <TouchableOpacity
            onPress={handleOpenTradeModal}
            className="flex-1 bg-brand-accent-deep rounded-full py-4 px-6"
            activeOpacity={0.8}
          >
            <Text className="font-sans text-base text-base-canvas text-center font-medium">
              Predloži razmenu
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Trade Request Modal */}
      <Modal
        visible={showTradeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTradeModal(false)}
      >
        <View className="flex-1 bg-base-canvas">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-ink-dark/10">
            <TouchableOpacity onPress={() => setShowTradeModal(false)}>
              <Ionicons name="close" size={28} color="#2B2A2B" />
            </TouchableOpacity>
            <Text className="font-display text-xl text-ink-dark">
              Predloži razmenu
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView className="flex-1 px-6 py-6">
            {/* Info */}
            <Text className="font-sans text-sm text-ink-dark mb-4">
              Izaberi jedan od tvojih itema za razmenu:
            </Text>

            {/* Loading State */}
            {loadingUserItems && (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color="#431A43" />
              </View>
            )}

            {/* Empty State */}
            {!loadingUserItems && currentUserItems.length === 0 && (
              <View className="items-center py-12">
                <Ionicons name="shirt-outline" size={64} color="#2B2A2B" opacity={0.3} />
                <Text className="font-sans text-base text-ink-dark mt-4 text-center">
                  Nemaš iteme za razmenu.{'\n'}Dodaj svoje iteme prvo!
                </Text>
              </View>
            )}

            {/* User Items List */}
            {!loadingUserItems && currentUserItems.map((currentUserItem) => (
              <TouchableOpacity
                key={currentUserItem._id}
                onPress={() => setSelectedItemId(currentUserItem._id)}
                className={`flex-row items-center mb-4 p-4 rounded-2xl border-2 ${
                  selectedItemId === currentUserItem._id
                    ? 'border-brand-accent-deep bg-brand-accent-deep/5'
                    : 'border-ink-dark/10'
                }`}
                activeOpacity={0.7}
              >
                {/* Radio Button */}
                <View
                  className={`w-6 h-6 rounded-full border-2 mr-4 items-center justify-center ${
                    selectedItemId === currentUserItem._id
                      ? 'border-brand-accent-deep'
                      : 'border-ink-dark/30'
                  }`}
                >
                  {selectedItemId === currentUserItem._id && (
                    <View className="w-3 h-3 rounded-full bg-brand-accent-deep" />
                  )}
                </View>

                {/* Item Image */}
                <Image
                  source={{ uri: currentUserItem.images[0] }}
                  className="w-16 h-16 rounded-xl mr-3"
                />

                {/* Item Info */}
                <View className="flex-1">
                  <Text className="font-sans text-base text-ink-dark font-medium">
                    {currentUserItem.title}
                  </Text>
                  <Text className="font-sans text-sm text-ink-dark/60 mt-1">
                    {currentUserItem.brand}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Optional Message */}
            {currentUserItems.length > 0 && (
              <View className="mt-6">
                <Text className="font-sans text-sm text-ink-dark font-medium mb-2">
                  Poruka (opciono)
                </Text>
                <TextInput
                  value={tradeMessage}
                  onChangeText={setTradeMessage}
                  placeholder="Dodaj poruku..."
                  placeholderTextColor="#2B2A2B60"
                  multiline
                  maxLength={300}
                  className="border border-ink-dark/20 rounded-2xl p-4 font-sans text-base text-ink-dark min-h-[100px]"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="font-sans text-xs text-ink-dark/60 mt-2 text-right">
                  {tradeMessage.length}/300
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          {currentUserItems.length > 0 && (
            <View className="px-6 py-4 border-t border-ink-dark/10">
              <TouchableOpacity
                onPress={handleSubmitTrade}
                disabled={!selectedItemId || submittingTrade}
                className={`rounded-full py-4 px-6 ${
                  selectedItemId && !submittingTrade
                    ? 'bg-brand-accent-deep'
                    : 'bg-ink-dark/20'
                }`}
                activeOpacity={0.8}
              >
                {submittingTrade ? (
                  <ActivityIndicator size="small" color="#F6F8ED" />
                ) : (
                  <Text className="font-sans text-base text-base-canvas text-center font-medium">
                    Pošalji zahtev
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
