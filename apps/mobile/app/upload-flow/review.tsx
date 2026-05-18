import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/velveAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import client from '@/api/client';
import { BrandBackground } from '@/components/BrandBackground';
import { BrandedLoader } from '@/components/BrandedLoader';
import { FullscreenImageModal } from '@/components/FullscreenImageModal';
import { GlassSurface } from '@/components/GlassSurface';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';

type ImagesPayload = {
  imageOriginal: string | null;
  imageClean: string | null;
  isDigitized: boolean;
};

export default function CleanCutReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { t } = useI18n();
  const [payload, setPayload] = useState<ImagesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreenTarget, setFullscreenTarget] = useState<{
    title: string;
    imageUri?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!itemId) {
      router.replace('/upload-flow');
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await client.get(`/api/items/${itemId}/images`);
        if (active) {
          setPayload(response.data?.data);
        }
      } catch {
        if (active) {
          Alert.alert(t('upload.reviewLoadErrorTitle'), t('upload.reviewLoadErrorDescription'), [
            { text: t('common.close'), onPress: () => router.replace('/upload-flow') },
          ]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [itemId, router, t]);

  async function retryFlow() {
    try {
      if (itemId) await client.delete(`/api/items/${itemId}`);
    } catch {
      // ignore cleanup
    } finally {
      router.replace('/upload-flow');
    }
  }

  if (loading) return <BrandedLoader />;

  return (
    <View className="flex-1 bg-base-canvas" style={{ paddingTop: insets.top + 8 }}>
      <BrandBackground />

      {/* Header */}
      <View className="flex-row items-center px-5 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
        </TouchableOpacity>
        <View className="flex-1" />
        <Text className="font-sans text-xs text-ink-dark/40">1 / 4</Text>
      </View>

      {/* Progress bar */}
      <View className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-ink-dark/8">
        <View className="h-full w-1/4 rounded-full bg-brand-accent-deep" />
      </View>

      <View className="flex-1 px-5 pt-8">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          {t('upload.reviewEyebrow')}
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">{t('upload.reviewTitle')}</Text>

        {/* Side by side comparison */}
        <View className="mt-8 flex-row gap-3">
          <TouchableOpacity
            activeOpacity={0.88}
            className="flex-1"
            onPress={() =>
              setFullscreenTarget({
                title: t('upload.original'),
                imageUri: payload?.imageOriginal,
              })
            }
          >
            <GlassSurface className="px-3 py-3">
              <Text className="mb-3 text-center font-sans text-[10px] uppercase tracking-[1.2px] text-ink-dark/40">
                {t('upload.original')}
              </Text>
              <RemoteImage
                uri={payload?.imageOriginal || undefined}
                className="aspect-[3/4] w-full rounded-[22px]"
                contentFit="contain"
              />
            </GlassSurface>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            className="flex-1"
            onPress={() =>
              setFullscreenTarget({
                title: t('upload.cleaned'),
                imageUri: payload?.imageClean,
              })
            }
          >
            <GlassSurface className="px-3 py-3">
              <Text className="mb-3 text-center font-sans text-[10px] uppercase tracking-[1.2px] text-ink-dark/40">
                {t('upload.cleaned')}
              </Text>
              <RemoteImage
                uri={payload?.imageClean || undefined}
                className="aspect-[3/4] w-full rounded-[22px]"
                contentFit="contain"
              />
            </GlassSurface>
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View className="mt-5 flex-row items-start rounded-[20px] bg-brand-accent-light/15 px-4 py-3">
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.accentDeep}
            style={{ marginTop: 1 }}
          />
          <Text className="ml-2 flex-1 font-sans text-xs leading-5 text-ink-dark/55">
            {t('upload.reviewHint')}
          </Text>
        </View>
      </View>

      {/* Bottom CTAs */}
      <View className="px-5" style={{ paddingBottom: insets.bottom + 12 }}>
        <TouchableOpacity
          className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
          onPress={() =>
            router.push({
              pathname: '/upload-flow/category',
              params: { itemId },
            })
          }
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            {t('upload.reviewContinue')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="mt-3 items-center rounded-full px-4 py-3" onPress={retryFlow}>
          <Text className="font-sans text-sm font-semibold text-ink-dark/50">
            {t('upload.retry')}
          </Text>
        </TouchableOpacity>
      </View>

      <FullscreenImageModal
        visible={!!fullscreenTarget}
        title={fullscreenTarget?.title || ''}
        imageUri={fullscreenTarget?.imageUri}
        onClose={() => setFullscreenTarget(null)}
      />
    </View>
  );
}
