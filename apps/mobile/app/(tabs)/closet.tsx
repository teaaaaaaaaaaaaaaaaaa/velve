import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import client from '@/api/client';
import { EditorialEmptyState } from '@/components/EditorialEmptyState';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';
import { getPrimaryItemImage } from '@/lib/itemImages';
import { Alert } from '@/lib/velveAlert';

type ClosetBucket = 'live' | 'drafts' | 'archive';

type ClosetItem = {
  _id: string;
  title: string;
  images?: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  isDigitized?: boolean;
  brand?: string;
  size?: string;
  status: string;
  archiveStatus?: string | null;
  listingType?: 'sell' | 'trade' | 'both';
};

type ClosetPayload = {
  live: ClosetItem[];
  drafts: ClosetItem[];
  archive: ClosetItem[];
};

function getStatusLabel(item: ClosetItem) {
  if (item.archiveStatus === 'deleted') return 'Deleted';
  if (item.archiveStatus === 'sold') return 'Sold';
  if (item.archiveStatus === 'swapped') return 'Swapped';
  if (item.status === 'pending_trade') return 'Pending';
  if (item.status === 'unavailable') return 'Paused';
  if (item.status === 'draft') return 'Draft';
  if (item.status === 'archived') return 'Archived';
  return 'Available';
}

function getStatusTone(item: ClosetItem) {
  if (item.archiveStatus === 'sold' || item.archiveStatus === 'swapped') {
    return 'bg-brand-highlight text-ink-dark';
  }

  if (item.status === 'pending_trade') return 'bg-brand-accent-light/30 text-brand-accent-deep';
  if (item.status === 'draft') return 'bg-base-canvas text-ink-dark';
  if (
    item.status === 'unavailable' ||
    item.status === 'archived' ||
    item.archiveStatus === 'deleted'
  ) {
    return 'bg-surface-panel text-ink-dark';
  }

  return 'bg-brand-highlight text-ink-dark';
}

const ClosetCard = memo(function ClosetCard({
  item,
  onOpen,
  onQuickAction,
  quickActionLabel,
  noDetailsLabel,
  openLabel,
  onDigitize,
  onDelete,
}: {
  item: ClosetItem;
  onOpen: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string | null;
  noDetailsLabel: string;
  openLabel: string;
  onDigitize?: () => void;
  onDelete?: () => void;
}) {
  const tone = getStatusTone(item).split(' ');

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpen}
      className="mb-4 overflow-hidden rounded-[28px] border border-ink-dark/5 bg-surface-panel px-4 py-4"
      style={{
        shadowColor: colors.inkDark,
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      }}
    >
      <View className="flex-row">
        <View className="mr-4 h-28 w-24 overflow-hidden rounded-[20px] bg-base-canvas">
          {getPrimaryItemImage(item) ? (
            <RemoteImage
              uri={getPrimaryItemImage(item) ?? undefined}
              className="h-full w-full"
              fallback={
                <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
                  <Ionicons name="shirt-outline" size={26} color={colors.accentDeep} />
                </View>
              }
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-brand-accent-light/20">
              <Ionicons name="shirt-outline" size={26} color={colors.accentDeep} />
            </View>
          )}
        </View>

        <View className="flex-1">
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-display text-2xl text-ink-dark" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="mt-1 font-sans text-xs text-ink-dark/55">
                {[item.brand, item.size ? item.size.toUpperCase() : null]
                  .filter(Boolean)
                  .join(' / ') || noDetailsLabel}
              </Text>
            </View>

            <View className={`rounded-full px-3 py-2 ${tone[0]}`}>
              <Text className={`font-sans text-xs font-semibold ${tone[1]}`}>
                {getStatusLabel(item)}
              </Text>
            </View>
          </View>

          <View className="mb-3 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-base-canvas px-3 py-2">
              <Text className="font-sans text-xs text-ink-dark/70">
                {item.listingType === 'both'
                  ? 'Trade + sell'
                  : item.listingType === 'sell'
                    ? 'Sell'
                    : 'Trade'}
              </Text>
            </View>

            {item.isDigitized ? (
              <View className="rounded-full bg-brand-highlight px-3 py-2">
                <Text className="font-sans text-xs font-semibold text-ink-dark">
                  Clean Cut ready
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={onOpen}
              className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
            >
              <Text className="font-sans text-xs font-semibold text-ink-dark">{openLabel}</Text>
            </TouchableOpacity>

            {onQuickAction && quickActionLabel ? (
              <TouchableOpacity
                onPress={onQuickAction}
                className="rounded-full bg-brand-accent-deep px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-base-canvas">
                  {quickActionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            {!item.isDigitized && onDigitize ? (
              <TouchableOpacity
                onPress={onDigitize}
                className="rounded-full bg-brand-highlight px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">Clean Cut</Text>
              </TouchableOpacity>
            ) : null}

            {onDelete ? (
              <TouchableOpacity
                onPress={onDelete}
                className="rounded-full border border-ink-dark/10 bg-base-canvas px-3 py-2"
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function ClosetSkeleton() {
  return (
    <View className="flex-1 bg-base-canvas px-5 pt-14">
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-1">
          <View className="h-3 w-16 rounded-full bg-surface-panel" />
          <View className="mt-3 h-10 w-40 rounded-full bg-surface-panel" />
        </View>
        <View className="h-11 w-11 rounded-full bg-surface-panel" />
      </View>
      <View className="mb-6 rounded-[28px] bg-surface-panel px-4 py-5">
        <View className="h-4 w-full rounded-full bg-base-canvas" />
        <View className="mt-3 h-4 w-2/3 rounded-full bg-base-canvas" />
        <View className="mt-5 flex-row gap-3">
          <View className="h-12 flex-1 rounded-full bg-base-canvas" />
          <View className="h-12 flex-1 rounded-full bg-base-canvas" />
        </View>
      </View>
      <View className="mb-6 h-16 rounded-[24px] bg-surface-panel" />
      {[0, 1, 2].map((entry) => (
        <View key={entry} className="mb-4 flex-row rounded-[28px] bg-surface-panel px-4 py-4">
          <View className="h-28 w-24 rounded-[20px] bg-base-canvas" />
          <View className="ml-4 flex-1">
            <View className="h-7 w-40 rounded-full bg-base-canvas" />
            <View className="mt-3 h-4 w-28 rounded-full bg-base-canvas" />
            <View className="mt-5 h-8 w-32 rounded-full bg-base-canvas" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ClosetScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const [closet, setCloset] = useState<ClosetPayload>({
    live: [],
    drafts: [],
    archive: [],
  });
  const [activeBucket, setActiveBucket] = useState<ClosetBucket>('live');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [digitizingItemId, setDigitizingItemId] = useState<string | null>(null);

  const visibleItems = closet[activeBucket];

  const loadCloset = useCallback(async () => {
    const response = await client.get('/api/items/closet');
    if (response.data.ok) {
      setCloset(response.data.data as ClosetPayload);
    }
  }, []);

  useEffect(() => {
    loadCloset()
      .catch(() => {
        Alert.alert(t('common.error'), t('closet.loadError'));
      })
      .finally(() => setLoading(false));
  }, [loadCloset, t]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadCloset();
    } finally {
      setRefreshing(false);
    }
  }, [loadCloset]);

  const withMutation = useCallback(
    async (callback: () => Promise<void>) => {
      try {
        setSubmitting(true);
        await callback();
        await loadCloset();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t('closet.mutationError');
        Alert.alert(t('common.error'), message);
      } finally {
        setSubmitting(false);
      }
    },
    [loadCloset, t]
  );

  const bucketCounts = useMemo(
    () => ({
      live: closet.live.length,
      drafts: closet.drafts.length,
      archive: closet.archive.length,
    }),
    [closet]
  );

  const quickActionLabel = useCallback(
    (item: ClosetItem) => {
      if (item.status === 'draft') return t('closet.publish');
      if (item.status === 'available') return t('closet.pause');
      if (item.status === 'unavailable' || item.status === 'archived')
        return t('closet.restoreLive');
      return null;
    },
    [t]
  );

  const handleQuickAction = useCallback(
    async (item: ClosetItem) => {
      await withMutation(async () => {
        const nextStatus =
          item.status === 'draft'
            ? 'available'
            : item.status === 'available'
              ? 'unavailable'
              : 'available';

        await client.put(`/api/items/${item._id}/status`, { status: nextStatus });
      });
    },
    [withMutation]
  );

  const handleDigitize = useCallback(
    async (item: ClosetItem) => {
      try {
        setDigitizingItemId(item._id);
        await client.post(`/api/items/${item._id}/digitize`);
        await loadCloset();
      } catch (unknownError: unknown) {
        const error = unknownError as {
          message?: string;
          response?: { data?: { error?: string } };
        };
        Alert.alert(
          t('closet.cleanCutFailedTitle'),
          error?.response?.data?.error || error?.message || t('closet.cleanCutRetry')
        );
      } finally {
        setDigitizingItemId(null);
      }
    },
    [loadCloset, t]
  );

  const handleDelete = useCallback(
    (item: ClosetItem) => {
      Alert.alert(t('closet.deleteTitle'), t('closet.deleteDescription', { title: item.title }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            withMutation(async () => {
              await client.delete(`/api/items/${item._id}`);
            }),
        },
      ]);
    },
    [t, withMutation]
  );

  const renderClosetItem = useCallback(
    ({ item }: { item: ClosetItem }) => (
      <View className="px-5">
        <ClosetCard
          item={item}
          onOpen={() => router.push(`/items/${item._id}`)}
          onQuickAction={
            quickActionLabel(item) && item.status !== 'pending_trade'
              ? () => handleQuickAction(item)
              : undefined
          }
          quickActionLabel={quickActionLabel(item)}
          noDetailsLabel={t('closet.noDetails')}
          openLabel={t('closet.open')}
          onDigitize={
            !item.isDigitized && !digitizingItemId ? () => handleDigitize(item) : undefined
          }
          onDelete={item.status === 'draft' ? () => handleDelete(item) : undefined}
        />
      </View>
    ),
    [digitizingItemId, handleDelete, handleDigitize, handleQuickAction, quickActionLabel, router, t]
  );

  const closetHeader = useMemo(
    () => (
      <View className="px-5 pt-14">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              {t('closet.eyebrow')}
            </Text>
            <Text className="font-display text-4xl text-ink-dark">{t('closet.title')}</Text>
          </View>
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View
          className="mb-6 overflow-hidden rounded-[28px] border border-brand-accent-deep/10 bg-surface-panel px-4 py-4"
          style={{
            shadowColor: colors.inkDark,
            shadowOpacity: 0.06,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Text className="font-sans text-sm leading-6 text-ink-dark/70">
            {t('closet.headerDescription')}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-3"
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Text className="font-sans text-sm font-semibold text-base-canvas">
                {t('closet.newListing')}
              </Text>
            </TouchableOpacity>
            {/* VTO archive button hidden for MVP — feature code kept, entry point removed. */}
          </View>
        </View>

        <View className="mb-6 flex-row rounded-[24px] bg-surface-panel p-2">
          {(['live', 'drafts', 'archive'] as ClosetBucket[]).map((bucket) => (
            <TouchableOpacity
              key={bucket}
              onPress={() => setActiveBucket(bucket)}
              className={`flex-1 rounded-[18px] px-3 py-3 ${bucket === activeBucket ? 'bg-brand-accent-deep' : ''}`}
            >
              <Text
                className={`text-center font-sans text-sm font-semibold ${
                  bucket === activeBucket ? 'text-base-canvas' : 'text-ink-dark/60'
                }`}
              >
                {bucket === 'live'
                  ? `Live (${bucketCounts.live})`
                  : bucket === 'drafts'
                    ? `Drafts (${bucketCounts.drafts})`
                    : `Archive (${bucketCounts.archive})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-5 px-0">
          <Text className="font-display text-3xl text-ink-dark">
            {activeBucket === 'live'
              ? t('closet.liveTitle')
              : activeBucket === 'drafts'
                ? t('closet.draftsTitle')
                : t('closet.archiveTitle')}
          </Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/60">
            {activeBucket === 'live'
              ? t('closet.liveDescription')
              : activeBucket === 'drafts'
                ? t('closet.draftsDescription')
                : t('closet.archiveDescription')}
          </Text>
        </View>
      </View>
    ),
    [activeBucket, bucketCounts, router, t]
  );

  if (loading) {
    return <ClosetSkeleton />;
  }

  return (
    <FlatList
      className="flex-1 bg-base-canvas"
      data={visibleItems}
      keyExtractor={(item) => item._id}
      renderItem={renderClosetItem}
      ListHeaderComponent={closetHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EditorialEmptyState
            icon={activeBucket === 'drafts' ? 'document-text-outline' : 'shirt-outline'}
            title={
              activeBucket === 'live'
                ? t('closet.liveEmptyTitle')
                : activeBucket === 'drafts'
                  ? t('closet.draftsEmptyTitle')
                  : t('closet.archiveEmptyTitle')
            }
            description={
              activeBucket === 'live'
                ? t('closet.liveEmptyDescription')
                : activeBucket === 'drafts'
                  ? t('closet.draftsEmptyDescription')
                  : t('closet.archiveEmptyDescription')
            }
            actionLabel={activeBucket === 'archive' ? undefined : t('closet.addListing')}
            onAction={activeBucket === 'archive' ? undefined : () => router.push('/(tabs)/upload')}
          />
        </View>
      }
      ListFooterComponent={
        submitting || digitizingItemId ? (
          <View className="py-2">
            <Text className="text-center font-sans text-sm text-ink-dark/55">
              {digitizingItemId ? t('closet.digitizing') : t('closet.updating')}
            </Text>
          </View>
        ) : null
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
    />
  );
}
