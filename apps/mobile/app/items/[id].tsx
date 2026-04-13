import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import client from '@/api/client';
import { BrandedLoader } from '@/components/BrandedLoader';
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard';
import { EditorialEmptyState } from '@/components/EditorialEmptyState';
import { GlassCountActionButton } from '@/components/GlassCountActionButton';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useAuth } from '@/hooks/useAuth';
import { getPrimaryItemImage, hasDigitizedImage } from '@/lib/itemImages';

type Owner = {
  _id: string;
  displayName: string;
  photoURL?: string;
  averageRating?: number;
  completedTrades?: number;
  location?: { city?: string; region?: string };
};
type Item = {
  _id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  isDigitized?: boolean;
  userId: Owner | string;
  createdAt: string;
  likesCount?: number;
  wishlistCount?: number;
  tradeRequestsCount?: number;
  isLiked?: boolean;
  isWishlisted?: boolean;
  listingType?: 'trade' | 'sell' | 'both';
  price?: number;
  tradeFor?: string;
  status?: string;
};
type UserItem = {
  _id: string;
  title: string;
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  brand: string;
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
};
const LISTING_LABELS: Record<'trade' | 'sell' | 'both', string> = {
  trade: 'Razmena',
  sell: 'Prodaja',
  both: 'Oba',
};
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ItemDetailsScreen() {
  const { id, viewOnly, openTrade } = useLocalSearchParams<{
    id: string;
    viewOnly?: string;
    openTrade?: string;
  }>();
  const router = useRouter();
  const { dbUser } = useAuth();
  const isViewOnly = viewOnly === 'true';

  const [item, setItem] = useState<Item | null>(null);
  const [similarItems, setSimilarItems] = useState<DiscoveryCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [tradeRequestsCount, setTradeRequestsCount] = useState(0);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentUserItems, setCurrentUserItems] = useState<UserItem[]>([]);
  const [proposalMode, setProposalMode] = useState<'trade' | 'buy'>('trade');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [loadingUserItems, setLoadingUserItems] = useState(false);
  const [submittingTrade, setSubmittingTrade] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCondition, setEditCondition] = useState<Item['condition']>('good');
  const [editListingType, setEditListingType] = useState<'trade' | 'sell' | 'both'>('trade');
  const [editPrice, setEditPrice] = useState('');
  const [editTradeFor, setEditTradeFor] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [digitizing, setDigitizing] = useState(false);
  const [checkingBodyScan, setCheckingBodyScan] = useState(false);

  const owner = item && typeof item.userId === 'object' ? item.userId : null;
  const isOwn =
    !!dbUser &&
    !!item &&
    (typeof item.userId === 'object' ? item.userId._id : item.userId) === dbUser._id;
  const availableProposalModes = useMemo(() => {
    if (!item || isOwn) return [] as Array<'trade' | 'buy'>;
    if (item.listingType === 'sell') return ['buy'] as Array<'trade' | 'buy'>;
    if (item.listingType === 'both') return ['trade', 'buy'] as Array<'trade' | 'buy'>;
    return ['trade'] as Array<'trade' | 'buy'>;
  }, [isOwn, item]);

  const hydrateEditState = (data: Item) => {
    setEditTitle(data.title || '');
    setEditDescription(data.description || '');
    setEditCategory(data.category || '');
    setEditBrand(data.brand || '');
    setEditSize(data.size || '');
    setEditCondition(data.condition || 'good');
    setEditListingType(data.listingType || 'trade');
    setEditPrice(data.price != null ? String(data.price) : '');
    setEditTradeFor(data.tradeFor || '');
  };

  const fetchUserItems = async () => {
    if (!dbUser) return;
    setLoadingUserItems(true);
    try {
      const response = await client.get('/api/items', { params: { userId: dbUser._id } });
      if (response.data.ok)
        setCurrentUserItems(
          response.data.data.filter(
            (entry: UserItem & { status?: string }) =>
              entry._id !== id && entry.status === 'available'
          )
        );
    } catch {
      Alert.alert('Greska', 'Nije moguce ucitati tvoje iteme.');
    } finally {
      setLoadingUserItems(false);
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      setLoadingSimilar(true);
      const [itemResult, similarResult] = await Promise.allSettled([
        client.get(`/api/items/${id}`),
        client.get(`/api/items/${id}/similar`, { params: { limit: 8 } }),
      ]);

      if (itemResult.status !== 'fulfilled') throw itemResult.reason;

      if (itemResult.value.data.ok) {
        const data = itemResult.value.data.data as Item;
        setItem(data);
        setIsLiked(!!data.isLiked);
        setLikesCount(data.likesCount || 0);
        setIsWishlisted(!!data.isWishlisted);
        setWishlistCount(data.wishlistCount || 0);
        setTradeRequestsCount(data.tradeRequestsCount || 0);
        hydrateEditState(data);
      }

      if (similarResult.status === 'fulfilled' && similarResult.value.data.ok) {
        setSimilarItems(similarResult.value.data.data);
      } else {
        const similarReason =
          similarResult.status === 'rejected'
            ? similarResult.reason?.message || String(similarResult.reason)
            : similarResult.value.data?.error || 'Unknown similar-items error';
        console.warn('[ItemDetails] Similar items unavailable for item', id, similarReason);
        setSimilarItems([]);
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce ucitati detalje predmeta.');
      router.back();
    } finally {
      setLoading(false);
      setLoadingSimilar(false);
    }
  };

  const handleLike = async () => {
    try {
      if (isLiked) {
        await client.delete(`/api/items/${id}/like`);
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        const response = await client.post(`/api/items/${id}/like`);
        if (response.data.ok) {
          setIsLiked(response.data.isLiked);
          setLikesCount(response.data.likesCount);
        }
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce azurirati lajk.');
    }
  };

  const handleWishlist = async () => {
    try {
      if (isWishlisted) {
        await client.delete(`/api/wishlist/${id}`);
        setIsWishlisted(false);
        setWishlistCount((prev) => Math.max(0, prev - 1));
      } else {
        await client.post(`/api/wishlist/${id}`);
        setIsWishlisted(true);
        setWishlistCount((prev) => prev + 1);
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce sacuvati ovu objavu.');
    }
  };

  const handleDelete = () =>
    Alert.alert('Obrisi predmet', 'Da li zelis da obrises ovu objavu?', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Obrisi',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/api/items/${id}`);
            router.replace('/(tabs)/closet');
          } catch {
            Alert.alert('Greska', 'Nije moguce obrisati predmet.');
          }
        },
      },
    ]);

  const handleMarkAsSold = () =>
    Alert.alert('Oznaci kao prodato', 'Ovaj komad ce preci u arhivu.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Oznaci',
        onPress: async () => {
          try {
            setMarkingSold(true);
            await client.put(`/api/items/${id}/sold`);
            router.replace('/(tabs)/closet');
          } catch {
            Alert.alert('Greska', 'Nije moguce oznaciti predmet kao prodat.');
          } finally {
            setMarkingSold(false);
          }
        },
      },
    ]);

  const handleDigitize = async () => {
    try {
      setDigitizing(true);
      await client.post(`/api/items/${id}/digitize`);
      await fetchItemDetails();
    } catch {
      Alert.alert('Greska', 'Clean Cut trenutno nije moguce pokrenuti.');
    } finally {
      setDigitizing(false);
    }
  };

  const handleTryOn = async () => {
    try {
      setCheckingBodyScan(true);
      const response = await client.get('/api/users/body-scan');
      const hasBodyScan = response.data?.data?.exists;
      if (hasBodyScan) {
        router.push({ pathname: '/vto/render', params: { itemId: id } });
      } else {
        router.push('/vto/body-scan');
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce pokrenuti Virtual Try-On.');
    } finally {
      setCheckingBodyScan(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editCategory.trim())
      return Alert.alert('Greska', 'Naslov i kategorija su obavezni.');
    try {
      setSavingEdit(true);
      const response = await client.put(`/api/items/${id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory.trim(),
        brand: editBrand.trim() || undefined,
        size: editSize.trim() || undefined,
        condition: editCondition,
        listingType: editListingType,
        price:
          editListingType === 'sell' || editListingType === 'both'
            ? editPrice.trim()
              ? Number(editPrice)
              : undefined
            : undefined,
        tradeFor:
          editListingType === 'trade' || editListingType === 'both'
            ? editTradeFor.trim() || undefined
            : undefined,
      });
      if (response.data.ok) {
        setShowEditModal(false);
        fetchItemDetails();
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce sacuvati izmene.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmitProposal = async () => {
    if (proposalMode === 'trade' && !selectedItemId) {
      return Alert.alert('Greska', 'Izaberi svoj komad koji nudis.');
    }

    if (proposalMode === 'buy' && !offeredPrice.trim()) {
      return Alert.alert('Greska', 'Unesi cenu koju nudis.');
    }

    try {
      setSubmittingTrade(true);
      const response = await client.post('/api/trades', {
        requestedItemId: id,
        ...(proposalMode === 'trade'
          ? { offeredItemId: selectedItemId }
          : { offeredPrice: Number(offeredPrice) }),
        message: tradeMessage.trim() || undefined,
      });

      if (response.data.ok) {
        const chatId = response.data.data?.chatId;
        setShowTradeModal(false);
        setTradeRequestsCount((prev) => prev + 1);
        setTradeMessage('');
        setSelectedItemId(null);
        setOfferedPrice('');

        Alert.alert('Uspeh', 'Predlog je poslat.', [
          {
            text: 'Otvori chat',
            onPress: () => router.push(chatId ? `/(tabs)/chat/${chatId}` : '/(tabs)/chat'),
          },
        ]);
      }
    } catch {
      Alert.alert('Greska', 'Nije moguce poslati predlog.');
    } finally {
      setSubmittingTrade(false);
    }
  };

  const handleHide = async () => {
    try {
      await client.post(`/api/items/${id}/hide`, { reason: 'not_interested' });
      router.replace('/(tabs)/feed');
    } catch {
      Alert.alert('Greska', 'Nije moguce sakriti ovu objavu.');
    }
  };

  const handleReport = async () => {
    try {
      await client.post(`/api/items/${id}/report`, { reason: 'community_report' });
      Alert.alert('Hvala', 'Prijava je poslata.');
    } catch {
      Alert.alert('Greska', 'Prijava trenutno nije moguca.');
    }
  };

  const handleBlockSeller = async () => {
    if (!owner) return;
    try {
      await client.post(`/api/users/${owner._id}/block`);
      Alert.alert('Korisnik blokiran', `@${owner.displayName} vise ti se nece prikazivati.`, [
        { text: 'U redu', onPress: () => router.replace('/(tabs)/feed') },
      ]);
    } catch {
      Alert.alert('Greska', 'Nije moguce blokirati korisnika.');
    }
  };

  const showActions = () =>
    Alert.alert('Discovery opcije', 'Prilagodi sta zelis da vidjas.', [
      { text: 'Sakrij objavu', onPress: handleHide },
      { text: 'Prijavi', onPress: handleReport },
      { text: 'Blokiraj', style: 'destructive', onPress: handleBlockSeller },
      { text: 'Odustani', style: 'cancel' },
    ]);

  const openTradeComposer = () => {
    if (item?.listingType === 'sell') {
      setProposalMode('buy');
    } else {
      setProposalMode('trade');
    }

    setTradeMessage('');
    setSelectedItemId(null);
    setOfferedPrice(item?.price != null ? String(item.price) : '');
    setShowTradeModal(true);
    if (item?.listingType !== 'sell') {
      fetchUserItems();
    }
  };

  useEffect(() => {
    fetchItemDetails();
  }, [id]);
  useEffect(() => {
    if (!loading && openTrade === 'true' && item) {
      openTradeComposer();
    }
  }, [loading, openTrade, item]);

  if (loading || !item) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BrandedLoader />
      </>
    );
  }

  const heroImage = getPrimaryItemImage(item);
  const showProposalButton = availableProposalModes.length > 0;
  const showPrice =
    (item.listingType === 'sell' || item.listingType === 'both') && item.price != null;
  const showTradeFor =
    (item.listingType === 'trade' || item.listingType === 'both') && !!item.tradeFor;
  const metadataLine = [
    item.category,
    item.brand,
    item.size ? item.size.toUpperCase() : null,
    CONDITION_LABELS[item.condition],
  ]
    .filter(Boolean)
    .join(' / ');
  const sellerLocation = owner?.location?.city
    ? `${owner.location.city}${owner.location.region ? `, ${owner.location.region}` : ''}`
    : null;

  const renderTradeModal = () => (
    <Modal
      visible={showTradeModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowTradeModal(false)}
    >
      <View className="flex-1 bg-base-canvas">
        <View className="flex-row items-center justify-between border-b border-ink-dark/10 px-6 pb-4 pt-10">
          <TouchableOpacity onPress={() => setShowTradeModal(false)}>
            <Ionicons name="close" size={26} color="#2B2A2B" />
          </TouchableOpacity>
          <Text className="font-display text-xl text-ink-dark">Posalji predlog</Text>
          <View className="w-6" />
        </View>
        <ScrollView className="flex-1 px-6 pt-5">
          {availableProposalModes.length > 1 ? (
            <View className="mb-5 flex-row rounded-[22px] bg-surface-panel p-1">
              {availableProposalModes.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    setProposalMode(mode);
                    if (mode === 'trade' && currentUserItems.length === 0) {
                      fetchUserItems();
                    }
                  }}
                  className={`flex-1 rounded-[18px] px-4 py-3 ${
                    proposalMode === mode ? 'bg-brand-accent-deep' : ''
                  }`}
                >
                  <Text
                    className={`text-center font-sans text-sm font-semibold ${
                      proposalMode === mode ? 'text-base-canvas' : 'text-ink-dark/60'
                    }`}
                  >
                    {mode === 'trade' ? 'Nudim komad' : 'Nudim cenu'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {proposalMode === 'trade' ? (
            <>
              <Text className="mb-4 font-sans text-sm text-ink-dark/65">
                Izaberi svoj komad koji saljes u razmenu.
              </Text>
              {loadingUserItems ? (
                <View className="items-center py-10">
                  <ActivityIndicator size="large" color={colors.accentDeep} />
                </View>
              ) : null}
              {!loadingUserItems && currentUserItems.length === 0 ? (
                <EditorialEmptyState
                  icon="shirt-outline"
                  title="Nemas jos komad za razmenu"
                  description="Dodaj svoju objavu pa se vrati ovde da posaljes prvi predlog."
                  actionLabel="Dodaj objavu"
                  onAction={() => {
                    setShowTradeModal(false);
                    router.push('/(tabs)/upload');
                  }}
                />
              ) : null}
              {currentUserItems.map((entry) => {
                const entryImage = getPrimaryItemImage(entry);

                return (
                  <TouchableOpacity
                    key={entry._id}
                    onPress={() => setSelectedItemId(entry._id)}
                    className={`mb-3 flex-row items-center rounded-[22px] border px-3 py-3 ${
                      selectedItemId === entry._id
                        ? 'border-brand-accent-deep bg-brand-accent-deep/5'
                        : 'border-ink-dark/10 bg-surface-panel'
                    }`}
                  >
                    <View
                      className={`mr-3 h-6 w-6 items-center justify-center rounded-full border ${
                        selectedItemId === entry._id ? 'border-brand-accent-deep' : 'border-ink-dark/25'
                      }`}
                    >
                      {selectedItemId === entry._id ? (
                        <View className="h-3 w-3 rounded-full bg-brand-accent-deep" />
                      ) : null}
                    </View>
                    {entryImage ? (
                      <RemoteImage
                        uri={entryImage}
                        className="h-16 w-16 rounded-2xl"
                        fallback={
                          <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
                            <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
                          </View>
                        }
                      />
                    ) : null}
                    {!entryImage ? (
                      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent-light/20">
                        <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
                      </View>
                    ) : null}
                    <View className="ml-3 flex-1">
                      <Text className="font-sans text-sm font-semibold text-ink-dark">{entry.title}</Text>
                      <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                        {entry.brand || 'Bez brenda'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <>
              <Text className="mb-2 font-sans text-sm text-ink-dark/65">
                Unesi cenu koju bi ponudio/la za ovaj komad.
              </Text>
              <TextInput
                value={offeredPrice}
                onChangeText={setOfferedPrice}
                keyboardType="numeric"
                placeholder="npr. 24"
                placeholderTextColor="#2B2A2B66"
                className="rounded-[24px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </>
          )}

          <Text className="mb-2 mt-5 font-sans text-sm text-ink-dark/65">Poruka (opciono)</Text>
          <TextInput
            value={tradeMessage}
            onChangeText={setTradeMessage}
            placeholder="Hocu da razmenim ovaj komad za..."
            placeholderTextColor="#2B2A2B66"
            multiline
            className="min-h-[110px] rounded-[24px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <View className="h-24" />
        </ScrollView>
        {(proposalMode === 'buy' || currentUserItems.length > 0) ? (
          <View className="border-t border-ink-dark/10 px-6 py-4">
            <TouchableOpacity
              onPress={handleSubmitProposal}
              disabled={(proposalMode === 'trade' && !selectedItemId) || (proposalMode === 'buy' && !offeredPrice.trim()) || submittingTrade}
              className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
            >
              {submittingTrade ? (
                <ActivityIndicator size="small" color={colors.baseCanvas} />
              ) : (
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  Posalji predlog
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditModal(false)}
    >
      <View className="flex-1 bg-base-canvas">
        <View className="flex-row items-center justify-between border-b border-ink-dark/10 px-6 pb-4 pt-10">
          <TouchableOpacity onPress={() => setShowEditModal(false)}>
            <Ionicons name="close" size={26} color="#2B2A2B" />
          </TouchableOpacity>
          <Text className="font-display text-xl text-ink-dark">Izmeni objavu</Text>
          <TouchableOpacity onPress={handleSaveEdit} disabled={savingEdit}>
            <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
              {savingEdit ? 'Cuvam...' : 'Sacuvaj'}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-6 pt-5">
          <Text className="mb-2 font-sans text-xs uppercase text-ink-dark/45">Naslov</Text>
          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Naslov..."
            placeholderTextColor="#2B2A2B66"
            className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Kategorija</Text>
          <TextInput
            value={editCategory}
            onChangeText={setEditCategory}
            placeholder="Kategorija..."
            placeholderTextColor="#2B2A2B66"
            className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Opis</Text>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Opis..."
            placeholderTextColor="#2B2A2B66"
            multiline
            className="min-h-[110px] rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-2 font-sans text-xs uppercase text-ink-dark/45">Brand</Text>
              <TextInput
                value={editBrand}
                onChangeText={setEditBrand}
                placeholder="Brand..."
                placeholderTextColor="#2B2A2B66"
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-2 font-sans text-xs uppercase text-ink-dark/45">Velicina</Text>
              <TextInput
                value={editSize}
                onChangeText={setEditSize}
                placeholder="Velicina..."
                placeholderTextColor="#2B2A2B66"
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </View>
          </View>
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Tip objave</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['trade', 'sell', 'both'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setEditListingType(type)}
                className={`rounded-full px-4 py-2 ${editListingType === type ? 'bg-brand-accent-deep' : 'bg-surface-panel'}`}
              >
                <Text
                  className={`font-sans text-sm ${editListingType === type ? 'text-base-canvas' : 'text-ink-dark'}`}
                >
                  {LISTING_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {editListingType === 'sell' || editListingType === 'both' ? (
            <>
              <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Cena</Text>
              <TextInput
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
                placeholder="npr. 24"
                placeholderTextColor="#2B2A2B66"
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </>
          ) : null}
          {editListingType === 'trade' || editListingType === 'both' ? (
            <>
              <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">
                Sta trazis za razmenu
              </Text>
              <TextInput
                value={editTradeFor}
                onChangeText={setEditTradeFor}
                placeholder="npr. oversized jakna"
                placeholderTextColor="#2B2A2B66"
                multiline
                className="min-h-[100px] rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </>
          ) : null}
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Stanje</Text>
          <View className="flex-row flex-wrap gap-2 pb-10">
            {(['new', 'like_new', 'good', 'fair'] as const).map((cond) => (
              <TouchableOpacity
                key={cond}
                onPress={() => setEditCondition(cond)}
                className={`rounded-full px-4 py-2 ${editCondition === cond ? 'bg-brand-accent-deep' : 'bg-surface-panel'}`}
              >
                <Text
                  className={`font-sans text-sm ${editCondition === cond ? 'text-base-canvas' : 'text-ink-dark'}`}
                >
                  {CONDITION_LABELS[cond]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-base-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        snapToOffsets={[0, SCREEN_HEIGHT - 150]}
        decelerationRate="fast"
      >
        <View style={{ height: SCREEN_HEIGHT - 90 }} className="bg-brand-accent-deep">
          {heroImage ? (
            <RemoteImage
              uri={heroImage}
              className="h-full w-full"
              fallback={
                <View className="h-full w-full items-center justify-center bg-brand-accent-deep">
                  <Ionicons name="shirt-outline" size={56} color="#F6F8ED" />
                </View>
              }
            />
          ) : (
            <View className="h-full items-center justify-center bg-brand-accent-deep">
              <Ionicons name="shirt-outline" size={56} color="#F6F8ED" />
            </View>
          )}
          <View className="absolute inset-0 bg-black/20" />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 top-14 h-11 w-11 items-center justify-center rounded-full bg-black/30"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          {!isOwn && !isViewOnly ? (
            <TouchableOpacity
              onPress={showActions}
              className="absolute right-4 top-14 h-11 w-11 items-center justify-center rounded-full bg-black/30"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="white" />
            </TouchableOpacity>
          ) : null}
          <View className="absolute bottom-[230px] left-4 right-24">
            <Text className="font-display text-3xl text-base-canvas">{item.title}</Text>
            <Text className="mt-2 font-sans text-sm text-base-canvas/90">{metadataLine}</Text>
          </View>
          {owner ? (
            <TouchableOpacity
              className="absolute bottom-[130px] left-4 right-24 flex-row items-center rounded-[24px] bg-white/15 px-3 py-3"
              activeOpacity={0.85}
              onPress={() =>
                !isOwn && router.push({ pathname: '/users/[id]', params: { id: owner._id } })
              }
            >
              {owner.photoURL ? (
                <RemoteImage
                  uri={owner.photoURL}
                  className="h-10 w-10 rounded-full"
                  fallback={
                    <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light">
                      <Text className="font-display text-xl text-brand-accent-deep">
                        {owner.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  }
                />
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-light">
                  <Text className="font-display text-xl text-brand-accent-deep">
                    {owner.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  @{owner.displayName}
                </Text>
                <Text className="font-sans text-xs text-base-canvas/75">
                  {owner.averageRating ? `${owner.averageRating.toFixed(1)} rating` : 'Novi profil'}{' '}
                  / {owner.completedTrades || 0} razmena
                </Text>
              </View>
              {!isOwn ? <Ionicons name="arrow-forward" size={18} color="#F6F8ED" /> : null}
            </TouchableOpacity>
          ) : null}
          {!isViewOnly ? (
            <View className="absolute bottom-24 right-3 items-center gap-3">
              <GlassCountActionButton
                icon={isLiked ? 'heart' : 'heart-outline'}
                count={likesCount}
                active={isLiked}
                onPress={handleLike}
                accessibilityLabel="Lajkuj predmet"
              />
              {!isOwn && showProposalButton ? (
                <GlassCountActionButton
                  icon="swap-horizontal"
                  count={tradeRequestsCount}
                  onPress={openTradeComposer}
                  accessibilityLabel="Posalji predlog"
                />
              ) : null}
              {!isOwn ? (
                <GlassCountActionButton
                  icon={isWishlisted ? 'bookmark' : 'bookmark-outline'}
                  count={wishlistCount}
                  active={isWishlisted}
                  onPress={handleWishlist}
                  accessibilityLabel="Sacuvaj predmet"
                />
              ) : null}
              {!isOwn && hasDigitizedImage(item) ? (
                <GlassCountActionButton
                  icon="body-outline"
                  onPress={handleTryOn}
                  accessibilityLabel="Probaj na sebi"
                />
              ) : null}
              {isOwn ? (
                <>
                  {!hasDigitizedImage(item) ? (
                    <GlassCountActionButton
                      icon="sparkles-outline"
                      onPress={handleDigitize}
                      accessibilityLabel="Digitizuj predmet"
                    />
                  ) : null}
                  <GlassCountActionButton
                    icon="pencil-outline"
                    onPress={() => setShowEditModal(true)}
                    accessibilityLabel="Izmeni objavu"
                  />
                  <GlassCountActionButton
                    icon="trash-outline"
                    onPress={handleDelete}
                    accessibilityLabel="Obrisi objavu"
                  />
                </>
              ) : null}
            </View>
          ) : null}
        </View>
        <View className="-mt-10 rounded-t-[36px] bg-base-canvas px-5 pt-4">
          <View className="mb-5 items-center">
            <View className="h-1 w-10 rounded-full bg-ink-dark/20" />
          </View>
          <View className="mb-4 flex-row items-center justify-between">
            <View className="rounded-full bg-brand-accent-deep/8 px-3 py-2">
              <Text className="font-sans text-xs font-semibold text-brand-accent-deep">
                {LISTING_LABELS[item.listingType || 'trade']}
              </Text>
            </View>
            {showPrice ? (
              <Text className="font-sans text-base font-semibold text-brand-accent-deep">
                {item.price} EUR
              </Text>
            ) : null}
          </View>
          <Text className="font-sans text-[15px] leading-6 text-ink-dark">
            {item.description ||
              'Ovaj komad jos nema opis, ali slicni predlozi i seller signal ispod daju dodatni kontekst.'}
          </Text>
          {showTradeFor ? (
            <View className="mt-4 rounded-[22px] bg-surface-panel px-4 py-4">
              <Text className="font-sans text-[11px] uppercase text-ink-dark/45">
                Trazi za razmenu
              </Text>
              <Text className="mt-1 font-sans text-sm text-ink-dark">{item.tradeFor}</Text>
            </View>
          ) : null}
          {owner ? (
            <View className="mt-4 rounded-[22px] bg-surface-panel px-4 py-4">
              <Text className="font-sans text-[11px] uppercase text-ink-dark/45">
                Seller signal
              </Text>
              <Text className="mt-1 font-sans text-sm text-ink-dark">
                {sellerLocation ? `${sellerLocation} / ` : ''}
                {owner.averageRating
                  ? `${owner.averageRating.toFixed(1)} rating`
                  : 'Bez ocena'} / {owner.completedTrades || 0} zavrsenih razmena
              </Text>
            </View>
          ) : null}
          {!isViewOnly && (showProposalButton || isOwn) ? (
            <View className="mt-5 flex-row gap-3">
              {showProposalButton ? (
                <TouchableOpacity
                  onPress={openTradeComposer}
                  className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-4"
                >
                  <Text className="font-sans text-sm font-semibold text-base-canvas">
                    Posalji predlog
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!isOwn && hasDigitizedImage(item) ? (
                <TouchableOpacity
                  onPress={handleTryOn}
                  disabled={checkingBodyScan}
                  className="flex-1 items-center rounded-full bg-brand-highlight px-4 py-4"
                >
                  {checkingBodyScan ? (
                    <ActivityIndicator size="small" color={colors.inkDark} />
                  ) : (
                    <Text className="font-sans text-sm font-semibold text-ink-dark">
                      Probaj na sebi
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {isOwn ? (
                <View className="flex-1 gap-3">
                  {!hasDigitizedImage(item) ? (
                    <TouchableOpacity
                      onPress={handleDigitize}
                      disabled={digitizing}
                      className="items-center rounded-full bg-brand-highlight px-4 py-4"
                    >
                      {digitizing ? (
                        <ActivityIndicator size="small" color="#2B2A2B" />
                      ) : (
                        <Text className="font-sans text-sm font-semibold text-ink-dark">Clean Cut</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={handleTryOn}
                      disabled={checkingBodyScan}
                      className="items-center rounded-full bg-brand-highlight px-4 py-4"
                    >
                      {checkingBodyScan ? (
                        <ActivityIndicator size="small" color={colors.inkDark} />
                      ) : (
                        <Text className="font-sans text-sm font-semibold text-ink-dark">Virtual Try-On</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={handleMarkAsSold}
                    disabled={markingSold}
                    className="items-center rounded-full border border-ink-dark/15 px-4 py-4"
                  >
                    {markingSold ? (
                      <ActivityIndicator size="small" color="#431A43" />
                    ) : (
                      <Text className="font-sans text-sm font-semibold text-ink-dark">Prodato</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
          <View className="mt-8">
            <Text className="font-display text-3xl text-ink-dark">Slicni komadi</Text>
            <Text className="mt-1 font-sans text-sm text-ink-dark/60">
              Vizuelno i ukusno bliski predlozi iz discovery sloja.
            </Text>
            {loadingSimilar ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color="#431A43" />
              </View>
            ) : similarItems.length === 0 ? (
              <View className="pt-4">
                <EditorialEmptyState
                  icon="sparkles-outline"
                  title="Jos nema slicnih komada"
                  description="Kada embedding i discovery signali dobiju vise podataka, ovde ce stizati precizniji predlozi."
                />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: 12,
                  paddingTop: 16,
                  paddingBottom: 8,
                  paddingRight: 12,
                }}
              >
                {similarItems.map((similar) => (
                  <View key={similar._id} style={{ width: 176 }}>
                    <DiscoveryItemCard
                      item={similar}
                      onPress={() => router.push(`/items/${similar._id}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
      {renderTradeModal()}
      {renderEditModal()}
    </View>
  );
}
