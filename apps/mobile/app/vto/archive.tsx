import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import client from '@/api/client';
import { BrandedLoader } from '@/components/BrandedLoader';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { getPrimaryItemImage, hasDigitizedImage } from '@/lib/itemImages';

type ClosetItem = {
  _id: string;
  title: string;
  brand?: string;
  images?: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  isDigitized?: boolean;
};

type ClosetPayload = {
  live: ClosetItem[];
  drafts: ClosetItem[];
  archive: ClosetItem[];
};

type BodyScanPayload = {
  exists: boolean;
  url: string | null;
};

type OutfitPayload = {
  _id: string;
  name: string;
  vtoImageUrl: string;
  itemIds: { _id: string; title: string; primaryImage?: string }[];
};

export default function VtoArchiveScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closet, setCloset] = useState<ClosetPayload>({ live: [], drafts: [], archive: [] });
  const [bodyScan, setBodyScan] = useState<BodyScanPayload>({ exists: false, url: null });
  const [outfits, setOutfits] = useState<OutfitPayload[]>([]);

  const digitizedItems = useMemo(
    () => [...closet.live, ...closet.drafts].filter((item) => hasDigitizedImage(item)),
    [closet]
  );

  async function loadAll() {
    const [closetResponse, bodyScanResponse, outfitsResponse] = await Promise.all([
      client.get('/api/items/closet'),
      client.get('/api/users/body-scan'),
      client.get('/api/vto/outfits'),
    ]);

    setCloset(closetResponse.data?.data || { live: [], drafts: [], archive: [] });
    setBodyScan(bodyScanResponse.data?.data || { exists: false, url: null });
    setOutfits(outfitsResponse.data?.data || []);
  }

  useEffect(() => {
    loadAll()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function onRefresh() {
    try {
      setRefreshing(true);
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <BrandedLoader />;
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 140 }}
    >
      <View className="px-5 pb-8 pt-14">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-logo text-[42px] text-brand-accent-deep">Velve</Text>
            <Text className="font-display text-4xl text-ink-dark">Tvoj Arhiv</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View className="mb-6 rounded-[28px] bg-surface-panel px-4 py-4">
          <Text className="font-sans text-sm leading-6 text-ink-dark/65">
            Virtual Try-On koristi samo digitalizovane komade.{' '}
            {bodyScan.exists ? 'Tvoj body scan je spreman.' : 'Body scan jos nije sacuvan.'}
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between">
          {digitizedItems.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={{ width: '48%' }}
              onPress={() => router.push(`/items/${item._id}`)}
              className="mb-4 overflow-hidden rounded-[26px] bg-surface-panel"
            >
              <RemoteImage
                uri={getPrimaryItemImage(item) ?? undefined}
                className="aspect-[0.8] w-full"
              />
              <View className="px-3 pb-4 pt-3">
                <Text className="font-display text-lg text-ink-dark" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="mt-1 font-sans text-xs text-ink-dark/55" numberOfLines={1}>
                  {item.brand || 'Digitalizovan komad'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {digitizedItems.length === 0 ? (
          <View className="rounded-[28px] bg-surface-panel px-4 py-6">
            <Text className="font-display text-2xl text-ink-dark">Nema spremnih komada</Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/65">
              Digitalizuj bar jedan komad kroz Clean Cut ili iz detalja artikla.
            </Text>
          </View>
        ) : null}

        {outfits.length > 0 ? (
          <View className="mt-8">
            <Text className="font-display text-3xl text-ink-dark">Sacuvani fitovi</Text>
            <View className="mt-4 gap-3">
              {outfits.map((outfit) => (
                <View
                  key={outfit._id}
                  className="flex-row items-center rounded-[24px] bg-surface-panel px-3 py-3"
                >
                  <RemoteImage uri={outfit.vtoImageUrl} className="h-20 w-16 rounded-[18px]" />
                  <View className="ml-3 flex-1">
                    <Text className="font-display text-2xl text-ink-dark">{outfit.name}</Text>
                    <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                      {(outfit.itemIds || []).map((item) => item.title).join(', ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View className="absolute bottom-8 left-5 right-5">
        <TouchableOpacity
          disabled={digitizedItems.length === 0}
          onPress={() => router.push(bodyScan.exists ? '/vto/hub' : '/vto/body-scan')}
          className={`items-center rounded-[28px] bg-brand-accent-deep px-4 py-4 ${
            digitizedItems.length > 0 ? '' : 'opacity-40'
          }`}
        >
          <Text className="font-display text-xl text-base-canvas">Magicno Isprobaj (VTO)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
