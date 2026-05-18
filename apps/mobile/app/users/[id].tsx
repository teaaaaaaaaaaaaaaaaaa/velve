import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from '@/lib/velveAlert';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import client from '@/api/client';
import { BrandedLoader } from '@/components/BrandedLoader';
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard';
import { EditorialEmptyState } from '@/components/EditorialEmptyState';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';
import { getApiErrorMessage } from '@/lib/apiErrors';

type PublicUser = {
  _id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  averageRating?: number;
  completedTrades?: number;
  followersCount?: number;
  followingCount?: number;
  itemsCount?: number;
  location?: { city?: string; region?: string };
  isSelf?: boolean;
  isFollowing?: boolean;
  joinedAt?: string;
  responseRate?: number | null;
  successfulSwaps?: number;
  profileCompleteness?: number;
  stylePreferences?: string[];
  favoriteBrands?: string[];
};

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, formatDate } = useI18n();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [items, setItems] = useState<DiscoveryCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [userResponse, itemsResponse] = await Promise.all([
        client.get(`/api/users/${id}`),
        client.get('/api/items', { params: { userId: id, limit: 30 } }),
      ]);

      if (userResponse.data.ok) {
        const userData = userResponse.data.data as PublicUser;
        setUser(userData);
        setIsFollowing(Boolean(userData.isFollowing));
        setFollowersCount(userData.followersCount || 0);
      }

      if (itemsResponse.data.ok) {
        setItems(itemsResponse.data.data as DiscoveryCardItem[]);
      }
      setErrorMessage('');
    } catch (error) {
      setUser(null);
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, t('publicProfile.unavailableDescription')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id, t]);

  useEffect(() => {
    if (user?.isSelf) {
      router.replace('/(tabs)/profile');
    }
  }, [router, user?.isSelf]);

  const handleReport = () => {
    if (!id) return;
    Alert.alert(t('feed.reportTitle'), t('feed.reportDescription'), [
      {
        text: t('feed.reportCta'),
        onPress: async () => {
          try {
            await client.post(`/api/users/${id}/report`, { reason: 'community_report' });
            Alert.alert(t('feed.reportSuccessTitle'), t('feed.reportSuccessDescription'));
          } catch {
            Alert.alert(t('common.error'), t('feed.reportError'));
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleBlock = () => {
    if (!id || !user) return;
    Alert.alert(t('feed.blockTitle'), t('feed.blockDescription', { name: user.displayName }), [
      {
        text: t('feed.blockCta'),
        style: 'destructive',
        onPress: async () => {
          try {
            await client.post(`/api/users/${id}/block`);
            Alert.alert(
              t('feed.blockSuccessTitle'),
              t('feed.blockSuccessDescription', { name: user.displayName }),
              [
                {
                  text: t('common.ok'),
                  onPress: () => router.replace('/(tabs)/feed'),
                },
              ]
            );
          } catch {
            Alert.alert(t('common.error'), t('feed.blockError'));
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleMoreOptions = () => {
    Alert.alert(
      `@${user?.displayName || t('common.user')}`,
      t('publicProfile.moreActionsDescription'),
      [
        { text: t('feed.reportItem'), onPress: handleReport },
        { text: t('feed.blockUser'), style: 'destructive', onPress: handleBlock },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleOpenChat = async () => {
    if (!id) return;
    try {
      const response = await client.post(`/api/chat/direct/${id}`);
      if (response.data.ok) {
        router.push(`/(tabs)/chat/${response.data.data.chatId as string}`);
      }
    } catch {
      Alert.alert(t('common.error'), t('publicProfile.chatError'));
    }
  };

  const handleFollow = async () => {
    if (!id || followLoading) return;

    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => prev + (wasFollowing ? -1 : 1));

    try {
      if (wasFollowing) {
        await client.delete(`/api/users/${id}/follow`);
      } else {
        await client.post(`/api/users/${id}/follow`);
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowersCount((prev) => prev + (wasFollowing ? 1 : -1));
      Alert.alert(t('common.error'), t('publicProfile.followError'));
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BrandedLoader />
      </>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-base-canvas px-4 pt-20">
        <Stack.Screen options={{ headerShown: false }} />
        <EditorialEmptyState
          icon="person-outline"
          title={t('publicProfile.unavailableTitle')}
          description={errorMessage || t('publicProfile.unavailableDescription')}
          actionLabel={t('common.retry')}
          onAction={loadProfile}
        />
      </View>
    );
  }

  if (user.isSelf) return null;

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5 pb-8 pt-14">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={22} color={colors.inkDark} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMoreOptions}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View
          className="overflow-hidden rounded-[34px] border border-ink-dark/6 bg-surface-panel px-5 pb-5 pt-6"
          style={{
            shadowColor: colors.inkDark,
            shadowOpacity: 0.08,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <View className="flex-row items-center">
            {user.photoURL ? (
              <RemoteImage
                uri={user.photoURL}
                className="h-24 w-24 rounded-full"
                fallback={
                  <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/40">
                    <Text className="font-display text-4xl text-brand-accent-deep">
                      {user.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
              />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-accent-light/40">
                <Text className="font-display text-4xl text-brand-accent-deep">
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="font-display text-4xl text-ink-dark">{user.displayName}</Text>
              {user.location?.city ? (
                <Text className="mt-1 font-sans text-sm text-ink-dark/55">
                  {user.location.city}
                  {user.location.region ? `, ${user.location.region}` : ''}
                </Text>
              ) : null}
              <Text className="mt-2 font-sans text-sm text-brand-accent-deep">
                {user.joinedAt
                  ? t('profile.joinedPrefix', {
                      date: formatDate(user.joinedAt, {
                        month: 'long',
                        year: 'numeric',
                      }),
                    })
                  : t('profile.newMember')}
              </Text>
            </View>
          </View>

          <Text className="mt-5 font-sans text-sm leading-6 text-ink-dark/75">
            {user.bio || t('publicProfile.defaultBio')}
          </Text>

          <View className="mt-5 flex-row rounded-[24px] bg-base-canvas px-4 py-4">
            <View className="flex-1 items-center">
              <Text className="font-display text-2xl text-ink-dark">
                {user.itemsCount || items.length}
              </Text>
              <Text className="font-sans text-xs text-ink-dark/50">{t('publicProfile.posts')}</Text>
            </View>
            <TouchableOpacity
              className="flex-1 items-center"
              onPress={() =>
                router.push({
                  pathname: '/connections',
                  params: { userId: user._id, tab: 'followers' },
                })
              }
            >
              <Text className="font-display text-2xl text-ink-dark">{followersCount}</Text>
              <Text className="font-sans text-xs text-ink-dark/50">{t('profile.followers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center"
              onPress={() =>
                router.push({
                  pathname: '/connections',
                  params: { userId: user._id, tab: 'following' },
                })
              }
            >
              <Text className="font-display text-2xl text-ink-dark">
                {user.followingCount || 0}
              </Text>
              <Text className="font-sans text-xs text-ink-dark/50">{t('profile.following')}</Text>
            </TouchableOpacity>
            <View className="flex-1 items-center">
              <Text className="font-display text-2xl text-ink-dark">
                {user.successfulSwaps || user.completedTrades || 0}
              </Text>
              <Text className="font-sans text-xs text-ink-dark/50">{t('profile.trades')}</Text>
            </View>
          </View>

          <View className="mt-5 flex-row items-center gap-3">
            <TouchableOpacity
              onPress={handleFollow}
              disabled={followLoading}
              className={`flex-1 items-center rounded-full px-4 py-3 ${isFollowing ? 'border border-ink-dark/10 bg-base-canvas' : 'bg-brand-accent-deep'}`}
            >
              <Text
                className={`font-sans text-sm font-semibold ${isFollowing ? 'text-ink-dark' : 'text-base-canvas'}`}
              >
                {isFollowing ? t('publicProfile.unfollow') : t('publicProfile.follow')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenChat}
              accessibilityLabel={t('publicProfile.message')}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/25"
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.accentDeep} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-8">
          <Text className="font-display text-3xl text-ink-dark">{t('publicProfile.posts')}</Text>

          {items.length === 0 ? (
            <View className="mt-4">
              <EditorialEmptyState
                icon="shirt-outline"
                title={t('publicProfile.emptyListingsTitle')}
                description={t('publicProfile.emptyListingsDescription')}
              />
            </View>
          ) : (
            <View className="mt-4 flex-row flex-wrap justify-between">
              {items.map((item) => (
                <View key={item._id} style={{ width: '48%' }}>
                  <DiscoveryItemCard
                    item={item}
                    onPress={() => router.push(`/items/${item._id}`)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
