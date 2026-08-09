import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinchZoomView } from '@/components/PinchZoomView';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';

export default function CleanCutPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const { t } = useI18n();

  useEffect(() => {
    if (!imageUri) {
      router.replace('/upload-flow');
    }
  }, [imageUri, router]);

  if (!imageUri) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-base-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 px-5">
        <View className="flex-row items-center justify-between pb-4 pt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-soft"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
          <View className="h-11 w-11" />
        </View>

        <Text className="font-display text-4xl text-ink-dark">{t('upload.previewTitle')}</Text>

        <View className="mt-6 flex-1">
          <PinchZoomView className="overflow-visible">
            <View className="overflow-hidden rounded-[32px] border border-ink-dark/8 bg-surface-panel px-3 py-3">
              <RemoteImage
                uri={imageUri}
                className="aspect-[3/4] w-full rounded-[28px] bg-base-canvas"
                contentFit="contain"
              />
            </View>
          </PinchZoomView>
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12) + 4 }} className="pt-3">
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/upload-flow/analyze',
                params: { imageUri },
              })
            }
            className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {t('upload.next')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/upload-flow')}
            className="mt-3 items-center rounded-full border border-brand-accent-deep/15 bg-base-canvas px-4 py-4"
          >
            <Text className="font-sans text-base font-semibold text-ink-dark">
              {t('upload.chooseAnotherPhoto')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
