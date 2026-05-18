import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from '@/lib/velveAlert'
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import client from '@/api/client';
import { BrandBackground } from '@/components/BrandBackground';
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard';
import { EditorialEmptyState } from '@/components/EditorialEmptyState';
import { GlassCountActionButton } from '@/components/GlassCountActionButton';
import { ItemHeroOverlay } from '@/components/ItemHeroOverlay';
import { RemoteImage } from '@/components/RemoteImage';
import { VelveTextInput } from '@/components/VelveTextInput';
import { colors } from '@/design/tokens';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { getPrimaryItemImage, hasDigitizedImage } from '@/lib/itemImages';
import { showVelveToast } from '@/lib/velveAlert';

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
type UnavailableItem = {
  _id?: string;
  title?: string;
  status?: string;
  category?: string;
  primaryImage?: string | null;
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

function DetailInfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 rounded-[24px] bg-base-canvas px-4 py-4">
      <View className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-surface-soft">
        <Ionicons name={icon} size={17} color={colors.accentDeep} />
      </View>
      <Text className="font-sans text-[11px] uppercase text-ink-dark/45">{label}</Text>
      <Text className="mt-1 font-sans text-base font-bold text-ink-dark" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DetailPanel({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="mt-4 rounded-[26px] bg-base-canvas px-4 py-4">
      <View className="mb-3 flex-row items-center">
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-surface-soft">
          <Ionicons name={icon} size={16} color={colors.accentDeep} />
        </View>
        <Text className="font-sans text-xs font-bold uppercase text-ink-dark/55">{title}</Text>
      </View>
      {children}
    </View>
  );
}

type SideAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  active?: boolean;
  visible: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function ItemDetailsSkeleton() {
  return (
    <View className="flex-1 bg-base-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <BrandBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
        <View className="px-5 pb-8 pt-14">
          <View className="mb-5 h-11 w-11 rounded-full bg-surface-panel" />
          <View className="h-[520px] overflow-hidden rounded-[34px] bg-surface-panel">
            <View className="absolute bottom-0 left-0 right-0 px-5 pb-6">
              <View className="h-5 w-28 rounded-full bg-base-canvas/80" />
              <View className="mt-3 h-10 w-56 rounded-full bg-base-canvas/80" />
              <View className="mt-3 h-4 w-40 rounded-full bg-base-canvas/70" />
            </View>
          </View>
          <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-5">
            <View className="h-5 w-32 rounded-full bg-base-canvas" />
            <View className="mt-4 h-4 w-full rounded-full bg-base-canvas" />
            <View className="mt-3 h-4 w-4/5 rounded-full bg-base-canvas" />
          </View>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {[0, 1, 2, 3].map((entry) => (
              <View key={entry} className="h-24 min-w-[46%] flex-1 rounded-[24px] bg-surface-panel" />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function ItemDetailsScreen() {
  const { id, viewOnly, openTrade } = useLocalSearchParams<{
    id: string;
    viewOnly?: string;
    openTrade?: string;
  }>();
  const router = useRouter();
  const { dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const isViewOnly = viewOnly === 'true';

  const [item, setItem] = useState<Item | null>(null);
  const [unavailableItem, setUnavailableItem] = useState<UnavailableItem | null>(null);
  const [similarItems, setSimilarItems] = useState<DiscoveryCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [tradeRequestsCount, setTradeRequestsCount] = useState(0);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentUserItems, setCurrentUserItems] = useState<UserItem[]>([]);
  const [proposalMode, setProposalMode] = useState<'trade' | 'buy'>('trade');
  const [showProposalReview, setShowProposalReview] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [loadingUserItems, setLoadingUserItems] = useState(false);
  const [userItemsError, setUserItemsError] = useState<string | null>(null);
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

  const editInitialRef = useRef<{
    title: string; description: string; category: string; brand: string;
    size: string; condition: Item['condition']; listingType: 'trade' | 'sell' | 'both';
    price: string; tradeFor: string;
  } | null>(null);

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
  const showProposalButton = availableProposalModes.length > 0;
  const showActionError = (title: string, error: unknown, fallback: string) => {
    Alert.alert(title, getApiErrorMessage(error, fallback));
  };

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
    setUserItemsError(null);
    try {
      const response = await client.get('/api/items', { params: { userId: dbUser._id } });
      if (response.data.ok) {
        setCurrentUserItems(
          response.data.data.filter(
            (entry: UserItem & { status?: string }) =>
              entry._id !== id && entry.status === 'available'
          )
        );
        return;
      }

      throw new Error('INVALID_ITEMS_RESPONSE');
    } catch (error) {
      setCurrentUserItems([]);
      setUserItemsError(getApiErrorMessage(error, 'Tvoji komadi trenutno nisu dostupni.'));
    } finally {
      setLoadingUserItems(false);
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      setLoadingSimilar(true);
      setLoadError(null);
      const [itemResult, similarResult] = await Promise.allSettled([
        client.get(`/api/items/${id}`),
        client.get(`/api/items/${id}/similar`, { params: { limit: 8 } }),
      ]);

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

      if (itemResult.status !== 'fulfilled') {
        const status = itemResult.reason?.response?.status;
        if (status === 410) {
          setUnavailableItem(itemResult.reason?.response?.data?.data || { _id: id });
          setItem(null);
          return;
        }
        throw itemResult.reason;
      }

      if (itemResult.value.data.ok) {
        const data = itemResult.value.data.data as Item;
        setUnavailableItem(null);
        setItem(data);
        setIsLiked(!!data.isLiked);
        setLikesCount(data.likesCount || 0);
        setIsWishlisted(!!data.isWishlisted);
        setWishlistCount(data.wishlistCount || 0);
        setTradeRequestsCount(data.tradeRequestsCount || 0);
        hydrateEditState(data);
        return;
      }

      throw new Error('INVALID_ITEM_RESPONSE');
    } catch (error) {
      setItem(null);
      setUnavailableItem(null);
      setLoadError(getApiErrorMessage(error, 'Detalji ovog artikla trenutno nisu dostupni.'));
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
    } catch (error) {
      showActionError('Lajk nije azuriran', error, 'Pokusaj ponovo za nekoliko trenutaka.');
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
    } catch (error) {
      showActionError('Objava nije sacuvana', error, 'Pokusaj ponovo za nekoliko trenutaka.');
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
          } catch (error) {
            showActionError('Objava nije obrisana', error, 'Pokusaj ponovo za nekoliko trenutaka.');
          }
        },
      },
    ]);

  const markItemAsSold = async (viaVelve: boolean) => {
    try {
      setMarkingSold(true);
      const response = await client.put(`/api/items/${id}/sold`, { viaVelve });

      if (viaVelve && response.data?.tradeArchived) {
        Alert.alert('Razmena arhivirana', 'Artikal je oznacen kao prodat i trade je dodat u arhivu.', [
          { text: 'Otvori arhivu', onPress: () => router.replace('/trade-archive') },
        ]);
        return;
      }

      if (viaVelve && !response.data?.tradeArchived) {
        Alert.alert(
          'Artikal je arhiviran',
          'Nismo nasli aktivan Velve trade za ovaj artikal, ali je artikal oznacen kao prodat.',
          [{ text: 'U redu', onPress: () => router.replace('/(tabs)/closet') }]
        );
        return;
      }

      router.replace('/(tabs)/closet');
    } catch (error) {
      showActionError(
        'Artikal nije arhiviran',
        error,
        'Prodaja trenutno nije sacuvana. Pokusaj ponovo.'
      );
    } finally {
      setMarkingSold(false);
    }
  };

  const handleMarkAsSold = () =>
    Alert.alert('Oznaci kao prodato', 'Ovaj komad ce preci u arhivu.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Oznaci',
        onPress: () =>
          Alert.alert('Velve razmena?', 'Da li je ovo bilo putem Velve razmene?', [
            { text: 'Ne', onPress: () => markItemAsSold(false) },
            { text: 'Da', onPress: () => markItemAsSold(true) },
          ]),
      },
    ]);

  const handleDigitize = async () => {
    try {
      setDigitizing(true);
      await client.post(`/api/items/${id}/digitize`);
      await fetchItemDetails();
    } catch (error) {
      showActionError(
        'Clean Cut nije pokrenut',
        error,
        'Obrada trenutno nije dostupna. Pokusaj ponovo malo kasnije.'
      );
    } finally {
      setDigitizing(false);
    }
  };

  const handleTryOn = async () => {
    try {
      setCheckingBodyScan(true);
      router.push({ pathname: '/vto/render', params: { itemId: id, mode: 'quick' } });
    } catch (error) {
      showActionError(
        'Virtual Try-On nije otvoren',
        error,
        'Pokusaj ponovo za nekoliko trenutaka.'
      );
    } finally {
      setCheckingBodyScan(false);
    }
  };

  const openEditModal = () => {
    editInitialRef.current = {
      title: editTitle, description: editDescription, category: editCategory,
      brand: editBrand, size: editSize, condition: editCondition,
      listingType: editListingType, price: editPrice, tradeFor: editTradeFor,
    };
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    const initial = editInitialRef.current;
    const isDirty = initial && (
      editTitle !== initial.title || editDescription !== initial.description ||
      editCategory !== initial.category || editBrand !== initial.brand ||
      editSize !== initial.size || editCondition !== initial.condition ||
      editListingType !== initial.listingType || editPrice !== initial.price ||
      editTradeFor !== initial.tradeFor
    );
    if (isDirty) {
      Alert.alert('Nesnimljene izmene', 'Imaš nesnimljene izmene. Zatvori bez čuvanja?', [
        { text: 'Nastavi editovanje', style: 'cancel' },
        { text: 'Zatvori', style: 'destructive', onPress: () => setShowEditModal(false) },
      ]);
    } else {
      setShowEditModal(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editCategory.trim())
      return Alert.alert('Dopuni objavu', 'Naslov i kategorija su obavezni.');
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
        fetchItemDetails().catch(() => undefined);
        showVelveToast({
          title: 'Izmene sacuvane',
          message: 'Objava sada prikazuje najnovije podatke.',
          tone: 'success',
        });
      }
    } catch (error) {
      showActionError('Izmene nisu sacuvane', error, 'Pokusaj ponovo za nekoliko trenutaka.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmitProposal = async () => {
    const validationError = getProposalValidationError();
    if (validationError) return Alert.alert('Dopuni predlog', validationError);

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
        setShowProposalReview(false);

        Alert.alert('Predlog je poslat', 'Sta zelis dalje?', [
          {
            text: 'Otvori chat',
            onPress: () => router.push(chatId ? `/(tabs)/chat/${chatId}` : '/(tabs)/chat'),
          },
          {
            text: 'Ostani ovde',
            style: 'cancel',
            onPress: () =>
              showVelveToast({
                title: 'Predlog je stigao',
                message: 'Vlasnik sada moze da odgovori iz chata.',
                tone: 'success',
              }),
          },
        ]);
      }
    } catch (error) {
      showActionError('Predlog nije poslat', error, 'Pokusaj ponovo za nekoliko trenutaka.');
    } finally {
      setSubmittingTrade(false);
    }
  };

  const getProposalValidationError = () => {
    if (proposalMode === 'trade' && !selectedItemId) {
      return 'Izaberi svoj komad koji nudis.';
    }

    if (proposalMode === 'buy' && !offeredPrice.trim()) {
      return 'Unesi cenu koju nudis.';
    }

    if (proposalMode === 'buy' && (!Number.isFinite(Number(offeredPrice)) || Number(offeredPrice) <= 0)) {
      return 'Cena mora biti broj veci od 0.';
    }

    return null;
  };

  const openProposalReview = () => {
    const validationError = getProposalValidationError();
    if (validationError) {
      Alert.alert('Dopuni predlog', validationError);
      return;
    }

    setShowProposalReview(true);
  };

  const handleHide = async () => {
    try {
      await client.post(`/api/items/${id}/hide`, { reason: 'not_interested' });
      router.replace('/(tabs)/feed');
    } catch (error) {
      showActionError('Objava nije sakrivena', error, 'Pokusaj ponovo za nekoliko trenutaka.');
    }
  };

  const handleReport = () => {
    Alert.alert('Prijavi objavu?', 'Velve tim ce pregledati ovu objavu i korisnika.', [
      {
        text: 'Prijavi',
        onPress: async () => {
          try {
            await client.post(`/api/items/${id}/report`, { reason: 'community_report' });
            showVelveToast({
              title: 'Prijava je poslata',
              message: 'Velve tim ce pregledati objavu i korisnika.',
              tone: 'success',
            });
          } catch (error) {
            showActionError('Prijava nije poslata', error, 'Pokusaj ponovo za nekoliko trenutaka.');
          }
        },
      },
      { text: 'Odustani', style: 'cancel' },
    ]);
  };

  const handleBlockSeller = () => {
    if (!owner) return;
    Alert.alert('Blokiraj korisnika?', `@${owner.displayName} vise neces vidjati u feedu.`, [
      {
        text: 'Blokiraj',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/api/users/${owner._id}/block`);
            showVelveToast({
              title: 'Korisnik je blokiran',
              message: `@${owner.displayName} vise ti se nece prikazivati u feedu.`,
              tone: 'success',
            });
            router.replace('/(tabs)/feed');
          } catch (error) {
            showActionError('Korisnik nije blokiran', error, 'Pokusaj ponovo za nekoliko trenutaka.');
          }
        },
      },
      { text: 'Odustani', style: 'cancel' },
    ]);
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
    setShowProposalReview(false);
    setShowTradeModal(true);
    if (item?.listingType !== 'sell') {
      fetchUserItems();
    }
  };

  const sideActions = useMemo<SideAction[]>(() => {
    const canTryOn = item && !isOwn ? hasDigitizedImage(item) : false;
    const ownerCanTryOn = item && isOwn ? hasDigitizedImage(item) : false;

    return [
      {
        key: 'like',
        icon: isLiked ? 'heart' : 'heart-outline',
        count: likesCount,
        active: isLiked,
        visible: !isOwn,
        label: 'Lajkuj predmet',
        onPress: handleLike,
      },
      {
        key: 'proposal',
        icon: 'swap-horizontal',
        count: tradeRequestsCount,
        visible: !isOwn && showProposalButton,
        label: 'Posalji predlog',
        onPress: openTradeComposer,
      },
      {
        key: 'wishlist',
        icon: isWishlisted ? 'bookmark' : 'bookmark-outline',
        count: wishlistCount,
        active: isWishlisted,
        visible: !isOwn,
        label: 'Sacuvaj predmet',
        onPress: handleWishlist,
      },
      {
        key: 'tryon',
        icon: 'body-outline',
        visible: Boolean(canTryOn || ownerCanTryOn),
        disabled: checkingBodyScan,
        label: 'Probaj na sebi',
        onPress: handleTryOn,
      },
      {
        key: 'digitize-edit',
        icon: isOwn && item && !hasDigitizedImage(item) ? 'sparkles-outline' : 'pencil-outline',
        visible: Boolean(isOwn),
        disabled: digitizing,
        label: isOwn && item && !hasDigitizedImage(item) ? 'Digitizuj predmet' : 'Izmeni objavu',
        onPress: isOwn && item && !hasDigitizedImage(item) ? handleDigitize : openEditModal,
      },
      {
        key: 'delete',
        icon: 'trash-outline',
        visible: Boolean(isOwn),
        label: 'Obrisi objavu',
        onPress: handleDelete,
      },
    ];
  }, [
    checkingBodyScan,
    digitizing,
    handleDelete,
    handleDigitize,
    handleLike,
    handleTryOn,
    handleWishlist,
    isLiked,
    isOwn,
    isWishlisted,
    item,
    likesCount,
    openEditModal,
    openTradeComposer,
    showProposalButton,
    tradeRequestsCount,
    wishlistCount,
  ]);

  useEffect(() => {
    fetchItemDetails();
  }, [id]);
  useEffect(() => {
    if (!loading && openTrade === 'true' && item) {
      openTradeComposer();
    }
  }, [loading, openTrade, item]);

  if (loading || !item) {
    if (!loading && loadError) {
      return (
        <View className="flex-1 bg-base-canvas">
          <Stack.Screen options={{ headerShown: false }} />
          <BrandBackground />
          <View className="flex-1 items-center justify-center px-6">
            <EditorialEmptyState
              icon="alert-circle-outline"
              title="Detalji artikla trenutno nisu dostupni"
              description={loadError}
              actionLabel="Pokusaj ponovo"
              onAction={() => {
                fetchItemDetails().catch(() => undefined);
              }}
            />
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 rounded-full border border-ink-dark/10 bg-base-canvas/70 px-5 py-3.5"
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark">Nazad</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!loading && unavailableItem) {
      return (
        <View className="flex-1 bg-base-canvas">
          <Stack.Screen options={{ headerShown: false }} />
          <BrandBackground />
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
            <View className="px-5 pb-8 pt-14">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mb-7 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
              >
                <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
              </TouchableOpacity>

              <View className="items-center rounded-[30px] bg-surface-panel px-5 py-8">
                {unavailableItem.primaryImage ? (
                  <RemoteImage
                    uri={unavailableItem.primaryImage}
                    className="h-36 w-28 rounded-[24px] bg-base-canvas"
                  />
                ) : (
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-accent-light/25">
                    <Ionicons name="bag-remove-outline" size={34} color={colors.accentDeep} />
                  </View>
                )}
                <Text className="mt-5 text-center font-display text-4xl text-ink-dark">
                  Ovaj artikal vise nije dostupan
                </Text>
                <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/62">
                  {unavailableItem.title
                    ? `${unavailableItem.title} je prodat, arhiviran ili vise nije aktivan.`
                    : 'Artikal je prodat, arhiviran ili vise nije aktivan.'}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    unavailableItem.category
                      ? router.replace({ pathname: '/search', params: { category: unavailableItem.category } })
                      : router.replace('/(tabs)/feed')
                  }
                  className="mt-6 rounded-full bg-brand-accent-deep px-5 py-3.5"
                >
                  <Text className="font-sans text-sm font-semibold text-base-canvas">
                    {unavailableItem.category ? `Nadji slicne: ${unavailableItem.category}` : 'Nazad na feed'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-8">
                <Text className="font-display text-3xl text-ink-dark">Slicni dostupni komadi</Text>
                {loadingSimilar ? (
                  <View className="flex-row gap-3 py-4">
                    {[0, 1, 2].map((entry) => (
                      <View key={entry} className="h-56 w-44 rounded-[24px] bg-surface-panel" />
                    ))}
                  </View>
                ) : similarItems.length === 0 ? (
                  <View className="items-center py-8">
                    <Text className="font-sans text-sm text-ink-dark/50">
                      Trenutno nema slicnih dostupnih komada.
                    </Text>
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
        </View>
      );
    }

    return <ItemDetailsSkeleton />;
  }

  const heroImage = getPrimaryItemImage(item);
  const showPrice =
    (item.listingType === 'sell' || item.listingType === 'both') && item.price != null;
  const showTradeFor =
    (item.listingType === 'trade' || item.listingType === 'both') && !!item.tradeFor;
  const sellerLocation = owner?.location?.city
    ? `${owner.location.city}${owner.location.region ? `, ${owner.location.region}` : ''}`
    : null;
  const heroCardBottomOffset = 58;
  const selectedOfferItem = currentUserItems.find((entry) => entry._id === selectedItemId) || null;
  const requestedImage = getPrimaryItemImage(item);
  const offeredImage = selectedOfferItem ? getPrimaryItemImage(selectedOfferItem) : undefined;

  const renderTradeModal = () => (
    <Modal
      visible={showTradeModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowTradeModal(false)}
    >
      <View className="flex-1 bg-base-canvas">
        <View className="flex-row items-center justify-between border-b border-ink-dark/4 px-6 pb-4 pt-10">
          <TouchableOpacity onPress={() => setShowTradeModal(false)}>
            <Ionicons name="close" size={26} color="#2B2A2B" />
          </TouchableOpacity>
          <Text className="font-display text-xl text-ink-dark">Posalji predlog</Text>
          <View className="w-6" />
        </View>
        <ScrollView className="flex-1 px-6 pt-5">
          {showProposalReview ? (
            <>
              <Text className="mb-4 font-sans text-sm text-ink-dark/65">
                Proveri predlog pre slanja. Ovo ce otvoriti chat sa vlasnikom ako predlog prodje.
              </Text>

              <View className="rounded-[26px] bg-surface-panel px-4 py-4">
                <Text className="font-sans text-xs uppercase text-ink-dark/45">
                  Trazis
                </Text>
                <View className="mt-3 flex-row items-center">
                  {requestedImage ? (
                    <RemoteImage uri={requestedImage} className="h-16 w-16 rounded-2xl" />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent-light/20">
                      <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="font-sans text-base font-semibold text-ink-dark">
                      {item.title}
                    </Text>
                    <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                      Od {owner?.displayName || 'korisnika'}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-3 rounded-[26px] bg-surface-panel px-4 py-4">
                <Text className="font-sans text-xs uppercase text-ink-dark/45">
                  Saljes
                </Text>
                {proposalMode === 'trade' && selectedOfferItem ? (
                  <View className="mt-3 flex-row items-center">
                    {offeredImage ? (
                      <RemoteImage uri={offeredImage} className="h-16 w-16 rounded-2xl" />
                    ) : (
                      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent-light/20">
                        <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
                      </View>
                    )}
                    <View className="ml-3 flex-1">
                      <Text className="font-sans text-base font-semibold text-ink-dark">
                        {selectedOfferItem.title}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                        {selectedOfferItem.brand || 'Bez brenda'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="mt-3 flex-row items-center">
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent-light/20">
                      <Ionicons name="cash-outline" size={24} color={colors.accentDeep} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="font-sans text-base font-semibold text-ink-dark">
                        {Number(offeredPrice)} EUR
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                        Ponuda za kupovinu
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {tradeMessage.trim() ? (
                <View className="mt-3 rounded-[26px] bg-surface-panel px-4 py-4">
                  <Text className="font-sans text-xs uppercase text-ink-dark/45">Poruka</Text>
                  <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/70">
                    {tradeMessage.trim()}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity onPress={() => setShowProposalReview(false)} className="mt-5 self-center">
                <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                  Izmeni predlog
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
          {availableProposalModes.length > 1 ? (
            <View className="mb-5 flex-row rounded-[22px] bg-surface-panel p-1">
              {availableProposalModes.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    setProposalMode(mode);
                    setShowProposalReview(false);
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
                <View className="gap-3 py-2">
                  {[0, 1, 2].map((entry) => (
                    <View key={entry} className="h-[88px] rounded-[22px] bg-surface-panel" />
                  ))}
                </View>
              ) : null}
              {!loadingUserItems && userItemsError ? (
                <EditorialEmptyState
                  icon="alert-circle-outline"
                  title="Tvoji komadi trenutno nisu dostupni"
                  description={userItemsError}
                  actionLabel="Pokusaj ponovo"
                  onAction={() => {
                    fetchUserItems().catch(() => undefined);
                  }}
                />
              ) : null}
              {!loadingUserItems && !userItemsError && currentUserItems.length === 0 ? (
                <EditorialEmptyState
                  icon="shirt-outline"
                  title="Nemas jos komad za razmenu"
                  description="Dodaj svoju objavu pa se vrati ovde da posaljes prvi predlog."
                  actionLabel="Dodaj objavu"
                  onAction={() => {
                    setShowTradeModal(false);
                    (router as unknown as { dismissAll?: () => void }).dismissAll?.();
                    router.push('/upload-flow');
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
              <VelveTextInput
                value={offeredPrice}
                onChangeText={setOfferedPrice}
                keyboardType="numeric"
                placeholder="npr. 24"
                className="rounded-[24px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </>
          )}

          <Text className="mb-2 mt-5 font-sans text-sm text-ink-dark/65">Poruka (opciono)</Text>
          <VelveTextInput
            value={tradeMessage}
            onChangeText={setTradeMessage}
            placeholder="Hocu da razmenim ovaj komad za..."
            multiline
            className="min-h-[110px] rounded-[24px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
            </>
          )}
          <View className="h-24" />
        </ScrollView>
        {(proposalMode === 'buy' || currentUserItems.length > 0) ? (
          <View className="border-t border-ink-dark/4 px-6 py-4">
            <TouchableOpacity
              onPress={showProposalReview ? handleSubmitProposal : openProposalReview}
              disabled={(proposalMode === 'trade' && !selectedItemId) || (proposalMode === 'buy' && !offeredPrice.trim()) || submittingTrade}
              className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
            >
              {submittingTrade ? (
                <ActivityIndicator size="small" color={colors.baseCanvas} />
              ) : (
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  {showProposalReview ? 'Potvrdi i posalji' : 'Pregledaj predlog'}
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
      onRequestClose={handleCloseEditModal}
    >
      <View className="flex-1 bg-base-canvas">
        <View className="flex-row items-center justify-between border-b border-ink-dark/4 px-6 pb-4 pt-10">
          <TouchableOpacity onPress={handleCloseEditModal}>
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
          <VelveTextInput
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Naslov..."
            className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Kategorija</Text>
          <VelveTextInput
            value={editCategory}
            onChangeText={setEditCategory}
            placeholder="Kategorija..."
            className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">Opis</Text>
          <VelveTextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Opis..."
            multiline
            className="min-h-[110px] rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
          />
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-2 font-sans text-xs uppercase text-ink-dark/45">Brand</Text>
              <VelveTextInput
                value={editBrand}
                onChangeText={setEditBrand}
                placeholder="Brand..."
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-2 font-sans text-xs uppercase text-ink-dark/45">Velicina</Text>
              <VelveTextInput
                value={editSize}
                onChangeText={setEditSize}
                placeholder="Velicina..."
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
              <VelveTextInput
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
                placeholder="npr. 24"
                className="rounded-[22px] border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </>
          ) : null}
          {editListingType === 'trade' || editListingType === 'both' ? (
            <>
              <Text className="mb-2 mt-4 font-sans text-xs uppercase text-ink-dark/45">
                Sta trazis za razmenu
              </Text>
              <VelveTextInput
                value={editTradeFor}
                onChangeText={setEditTradeFor}
                placeholder="npr. oversized jakna"
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
    <View className="flex-1 bg-surface-panel">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        snapToOffsets={[0, SCREEN_HEIGHT - 86]}
        decelerationRate="fast"
      >
        <View style={{ height: SCREEN_HEIGHT - 8 }} className="bg-surface-panel">
          {heroImage ? (
            <RemoteImage
              uri={heroImage}
              className="h-full w-full"
              contentFit="contain"
              imageStyle={{ backgroundColor: colors.panel }}
              fallback={
                <View className="h-full w-full items-center justify-center bg-surface-panel">
                  <Ionicons name="shirt-outline" size={56} color={colors.accentDeep} />
                </View>
              }
            />
          ) : (
            <View className="h-full items-center justify-center bg-surface-panel">
              <Ionicons name="shirt-outline" size={56} color={colors.accentDeep} />
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            style={{ top: insets.top + 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.inkDark} />
          </TouchableOpacity>
          {!isOwn && !isViewOnly ? (
            <TouchableOpacity
              onPress={showActions}
              className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
              style={{ top: insets.top + 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.inkDark} />
            </TouchableOpacity>
          ) : null}
          <ItemHeroOverlay
            title={item.title}
            category={item.category}
            brand={item.brand}
            size={item.size}
            condition={item.condition}
            createdAt={item.createdAt}
            price={showPrice ? item.price : undefined}
            listingType={item.listingType}
            owner={owner}
            topInset={insets.top}
            bottomOffset={heroCardBottomOffset}
            onOwnerPress={
              owner && !isOwn
                ? () => router.push({ pathname: '/users/[id]', params: { id: owner._id } })
                : undefined
            }
            actionIcon={!isOwn && showProposalButton ? 'swap-horizontal' : undefined}
            actionAccessibilityLabel="Posalji predlog"
            onActionPress={!isOwn && showProposalButton ? openTradeComposer : undefined}
            showOwnerArrow={!isOwn}
          />
          {!isViewOnly ? (
            <View className="absolute right-3 items-center gap-3" style={{ bottom: heroCardBottomOffset + 118 }}>
              {sideActions.map((action) => (
                <View
                  key={action.key}
                  pointerEvents={action.visible ? 'auto' : 'none'}
                  style={{ opacity: action.visible ? 1 : 0 }}
                >
                  <GlassCountActionButton
                    icon={action.icon}
                    count={action.count}
                    active={action.active}
                    disabled={action.disabled}
                    onPress={action.onPress}
                    accessibilityLabel={action.label}
                    tone="dark"
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View className="-mt-2 rounded-t-[36px] bg-surface-panel px-5 pt-4">
          <View className="mb-5 items-center">
            <View className="h-1 w-10 rounded-full bg-ink-dark/20" />
          </View>

          <View className="mb-5 flex-row items-center justify-between">
            <View className="flex-row items-center rounded-full bg-surface-soft px-3 py-2">
              <Ionicons name="sparkles-outline" size={14} color={colors.accentDeep} />
              <Text className="ml-1.5 font-sans text-xs font-bold text-brand-accent-deep">
                {LISTING_LABELS[item.listingType || 'trade']}
              </Text>
            </View>
            {showPrice ? (
              <View className="rounded-full bg-brand-accent-deep px-4 py-2.5">
                <Text className="font-sans text-base font-bold text-base-canvas">
                  {item.price} EUR
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mb-5 flex-row flex-wrap gap-3">
            <DetailInfoPill icon="albums-outline" label="Kategorija" value={item.category || 'Nije uneto'} />
            <DetailInfoPill icon="resize-outline" label="Velicina" value={item.size ? item.size.toUpperCase() : 'Nije uneto'} />
            <DetailInfoPill icon="diamond-outline" label="Stanje" value={CONDITION_LABELS[item.condition]} />
            <DetailInfoPill icon="pricetag-outline" label="Brend" value={item.brand || 'Bez brenda'} />
          </View>

          <DetailPanel icon="document-text-outline" title="Opis">
            <Text className="font-sans text-[15px] leading-6 text-ink-dark">
              {item.description ||
                'Ovaj komad jos nema opis, ali seller signal i slicni predlozi ispod daju dodatni kontekst.'}
            </Text>
          </DetailPanel>
          {showTradeFor ? (
            <DetailPanel icon="repeat-outline" title="Trazi za razmenu">
              <Text className="font-sans text-sm leading-6 text-ink-dark">{item.tradeFor}</Text>
            </DetailPanel>
          ) : null}
          {owner ? (
            <DetailPanel icon="person-circle-outline" title="Seller signal">
              <View className="flex-row flex-wrap gap-2">
                {sellerLocation ? (
                  <View className="flex-row items-center rounded-full bg-brand-highlight px-3 py-2">
                    <Ionicons name="location" size={13} color={colors.inkDark} />
                    <Text className="ml-1.5 font-sans text-xs font-bold text-ink-dark">
                      {sellerLocation}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row items-center rounded-full bg-surface-soft px-3 py-2">
                  <Ionicons name="star-outline" size={13} color={colors.inkDark} />
                  <Text className="ml-1.5 font-sans text-xs font-semibold text-ink-dark">
                    {owner.averageRating ? `${owner.averageRating.toFixed(1)} rating` : 'Bez ocena'}
                  </Text>
                </View>
                <View className="flex-row items-center rounded-full bg-surface-soft px-3 py-2">
                  <Ionicons name="swap-horizontal" size={13} color={colors.inkDark} />
                  <Text className="ml-1.5 font-sans text-xs font-semibold text-ink-dark">
                    {owner.completedTrades || 0} razmena
                  </Text>
                </View>
              </View>
            </DetailPanel>
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
                        <ActivityIndicator size="small" color={colors.inkDark} />
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
                      <ActivityIndicator size="small" color={colors.accentDeep} />
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
            {loadingSimilar ? (
              <View className="flex-row gap-3 py-4">
                {[0, 1, 2].map((entry) => (
                  <View key={entry} className="h-56 w-44 rounded-[24px] bg-surface-panel" />
                ))}
              </View>
            ) : similarItems.length === 0 ? (
              <View className="items-center py-8">
                <Text className="font-sans text-sm text-ink-dark/50">
                  Jos uvek nema slicnih komada
                </Text>
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
