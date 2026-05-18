import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/velveAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import client from '@/api/client';
import { BrandBackground } from '@/components/BrandBackground';
import { BrandWordmark } from '@/components/BrandWordmark';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { VelveTextInput } from '@/components/VelveTextInput';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';
import { getPrimaryItemImage } from '@/lib/itemImages';

type ItemPayload = {
  _id: string;
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
};

const AI_TIMEOUT_SECONDS = 120;

function AiLoadingOverlay({
  onCancel,
  steps,
  cancelLabel,
  cancelA11yLabel,
  timeoutLabel,
}: {
  onCancel: () => void;
  steps: string[];
  cancelLabel: string;
  cancelA11yLabel: string;
  timeoutLabel: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(AI_TIMEOUT_SECONDS);
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStepIndex((prev) => (prev + 1) % steps.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [fade, steps.length]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: AI_TIMEOUT_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const countdown = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdown);
  }, [progress]);

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-base-canvas/95">
      <TouchableOpacity
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelA11yLabel}
        className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
      >
        <Ionicons name="close" size={22} color={colors.inkDark} />
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-accent-deep/10">
          <Ionicons name="sparkles" size={32} color={colors.accentDeep} />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fade, marginTop: 24 }}>
        <Text className="text-center font-sans text-base tracking-wide text-ink-dark/60">
          {steps[stepIndex]}
        </Text>
      </Animated.View>

      <View className="mt-6 w-[72%]">
        <View className="h-2 overflow-hidden rounded-full bg-ink-dark/10">
          <Animated.View
            className="h-full rounded-full bg-brand-accent-deep"
            style={{
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['6%', '100%'],
              }),
            }}
          />
        </View>
        <Text className="mt-3 text-center font-sans text-xs text-ink-dark/45">
          {timeoutLabel.replace('{{seconds}}', String(secondsLeft))}
        </Text>
      </View>

      <BrandWordmark width={100} style={{ marginTop: 32, opacity: 0.25 }} />

      <TouchableOpacity onPress={onCancel} className="mt-8 px-8 py-3">
        <Text className="font-sans text-sm text-ink-dark/45">{cancelLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DescriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, t } = useI18n();
  const params = useLocalSearchParams<{
    itemId: string;
    category: string;
    condition: string;
    listingType: string;
    price: string;
    tradeFor: string;
    brand: string;
    size: string;
  }>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const aiSteps = [
    t('upload.aiStep1'),
    t('upload.aiStep2'),
    t('upload.aiStep3'),
    t('upload.aiStep4'),
  ];

  // Fetch item to get image URL for AI
  useEffect(() => {
    if (!params.itemId) return;
    client
      .get(`/api/items/${params.itemId}`)
      .then((res) => {
        const item = res.data?.data as ItemPayload;
        const url = getPrimaryItemImage(item) || item?.images?.[0] || '';
        setImageUrl(url);
      })
      .catch(() => {});
  }, [params.itemId]);

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setGenerating(false);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, []);

  const generateAiDescription = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setGenerating(true);
    try {
      const response = await client.post(
        '/api/ai/generate-description',
        {
          category: params.category,
          brand: params.brand,
          size: params.size,
          condition: params.condition,
          image_url: imageUrl,
          language: locale,
        },
        { timeout: AI_TIMEOUT_SECONDS * 1000, signal: controller.signal }
      );

      const payload = response.data?.data;
      if (payload?.description) setDescription(payload.description);
      setGenerated(true);
    } catch (error: any) {
      if (controller.signal.aborted) return;
      Alert.alert(t('upload.aiUnavailableTitle'), t('upload.aiUnavailableDescription'));
    } finally {
      setGenerating(false);
    }
  }, [imageUrl, locale, params.brand, params.category, params.condition, params.size, t]);

  const publish = useCallback(
    async (status: 'available' | 'draft') => {
      const nextErrors = {
        title: title.trim() ? undefined : t('upload.titleRequired'),
        description: description.trim() ? undefined : t('upload.descriptionRequired'),
      };

      if (nextErrors.title || nextErrors.description) {
        setFieldErrors(nextErrors);
        return;
      }

      setFieldErrors({});
      setSaving(true);
      try {
        await client.put(`/api/items/${params.itemId}`, {
          title: title.trim(),
          description: description.trim(),
          category: params.category,
          brand: params.brand?.trim() || undefined,
          size: params.size?.trim() || undefined,
          condition: params.condition,
          listingType: params.listingType,
          price:
            params.listingType === 'sell' || params.listingType === 'both'
              ? Number(params.price) || undefined
              : undefined,
          tradeFor:
            params.listingType === 'trade' || params.listingType === 'both'
              ? params.tradeFor?.trim() || undefined
              : undefined,
        });

        await client.put(`/api/items/${params.itemId}/status`, { status });
        router.replace('/(tabs)/closet');
      } catch (error: any) {
        Alert.alert(
          t('common.error'),
          error?.response?.data?.error || error?.message || t('upload.saveError')
        );
      } finally {
        setSaving(false);
      }
    },
    [description, params, router, t, title]
  );

  const confirmPublish = useCallback(() => {
    const nextErrors = {
      title: title.trim() ? undefined : t('upload.titleRequired'),
      description: description.trim() ? undefined : t('upload.descriptionRequired'),
    };

    if (nextErrors.title || nextErrors.description) {
      setFieldErrors(nextErrors);
      return;
    }

    Alert.alert(t('upload.publishConfirmTitle'), t('upload.publishConfirmDescription'), [
      { text: t('upload.publish'), onPress: () => publish('available') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [description, publish, t, title]);

  return (
    <KeyboardAwareScreen className="bg-base-canvas">
      <BrandBackground />

      {generating ? (
        <AiLoadingOverlay
          onCancel={handleCancelGeneration}
          steps={aiSteps}
          cancelLabel={t('upload.aiCancel')}
          cancelA11yLabel={t('upload.aiCancelA11y')}
          timeoutLabel={t('upload.aiTimeout')}
        />
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
          <View className="flex-1" />
          <Text className="font-sans text-xs text-ink-dark/40">4 / 4</Text>
        </View>

        {/* Progress bar */}
        <View className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-ink-dark/8">
          <View className="h-full w-4/4 rounded-full bg-brand-accent-deep" />
        </View>

        <View className="px-5 pt-8">
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            {t('upload.descriptionEyebrow')}
          </Text>
          <Text className="mt-1 font-display text-4xl text-ink-dark">
            {t('upload.descriptionTitle')}
          </Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/55">
            {t('upload.descriptionIntro')}
          </Text>

          {/* AI Generate Button */}
          {!generated ? (
            <TouchableOpacity
              onPress={generateAiDescription}
              disabled={generating}
              className="mt-6 overflow-hidden rounded-[24px] border border-brand-accent-deep/15 bg-surface-panel"
              style={{
                shadowColor: colors.accentDeep,
                shadowOpacity: 0.1,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <View className="flex-row items-center px-5 py-5">
                <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent-light/25">
                  <Ionicons name="sparkles" size={22} color={colors.accentDeep} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans text-base font-semibold text-ink-dark">
                    {t('upload.aiButtonTitle')}
                  </Text>
                  <Text className="mt-0.5 font-sans text-xs text-ink-dark/50">
                    {t('upload.aiButtonDescription')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
              </View>
            </TouchableOpacity>
          ) : (
            <View className="mt-6 flex-row items-center rounded-[20px] bg-brand-highlight/20 px-4 py-3">
              <Ionicons name="checkmark-circle" size={20} color={colors.accentDeep} />
              <Text className="ml-2 flex-1 font-sans text-sm text-ink-dark/70">
                {t('upload.aiGeneratedNotice')}
              </Text>
              <TouchableOpacity onPress={generateAiDescription}>
                <Ionicons name="refresh" size={18} color={colors.accentDeep} />
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View className="my-6 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-ink-dark/8" />
            <Text className="font-sans text-xs text-ink-dark/30">
              {generated ? t('upload.editDivider') : t('upload.manualDivider')}
            </Text>
            <View className="h-px flex-1 bg-ink-dark/8" />
          </View>

          {/* Title */}
          <View>
            <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">
              {t('upload.titleLabel')}
            </Text>
            <VelveTextInput
              ref={titleInputRef}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder={t('upload.titlePlaceholder')}
              className={`rounded-[20px] border bg-surface-panel px-5 py-4 font-sans text-sm text-ink-dark ${
                fieldErrors.title ? 'border-signal-danger/35' : 'border-ink-dark/8'
              }`}
            />
            {fieldErrors.title ? (
              <Text className="mt-2 font-sans text-xs text-signal-danger">{fieldErrors.title}</Text>
            ) : null}
          </View>

          {/* Description */}
          <View className="mt-4">
            <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">
              {t('upload.descriptionLabel')}
            </Text>
            <VelveTextInput
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }
              }}
              placeholder={t('upload.descriptionPlaceholder')}
              multiline
              textAlignVertical="top"
              className={`min-h-[140px] rounded-[20px] border bg-surface-panel px-5 py-4 font-sans text-sm leading-6 text-ink-dark ${
                fieldErrors.description ? 'border-signal-danger/35' : 'border-ink-dark/8'
              }`}
            />
            {fieldErrors.description ? (
              <Text className="mt-2 font-sans text-xs text-signal-danger">
                {fieldErrors.description}
              </Text>
            ) : null}
          </View>

          {/* Summary chips */}
          <View className="mt-6 flex-row flex-wrap gap-2">
            {params.category ? (
              <View className="rounded-full bg-brand-accent-light/20 px-3 py-1.5">
                <Text className="font-sans text-xs font-semibold text-brand-accent-deep">
                  {params.category === 'Majice'
                    ? t('search.categoryTops')
                    : params.category === 'Haljine'
                      ? t('search.categoryDresses')
                      : params.category === 'Pantalone'
                        ? t('search.categoryPants')
                        : params.category === 'Jakne'
                          ? t('search.categoryOuterwear')
                          : params.category === 'Obuca'
                            ? t('search.categoryShoes')
                            : t('search.categoryAccessories')}
                </Text>
              </View>
            ) : null}
            {params.brand ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">{params.brand}</Text>
              </View>
            ) : null}
            {params.size ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">{params.size}</Text>
              </View>
            ) : null}
            {params.listingType ? (
              <View className="rounded-full bg-surface-panel px-3 py-1.5">
                <Text className="font-sans text-xs text-ink-dark/60">
                  {params.listingType === 'trade'
                    ? t('upload.typeTrade')
                    : params.listingType === 'sell'
                      ? t('upload.typeSell')
                      : t('upload.typeBoth')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-base-canvas px-5 pt-3"
        style={{
          paddingBottom: insets.bottom + 12,
          shadowColor: '#2B2A2B',
          shadowOpacity: 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
          elevation: 6,
        }}
      >
        <TouchableOpacity
          disabled={saving}
          onPress={confirmPublish}
          className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.baseCanvas} />
          ) : (
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {t('upload.publish')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={saving}
          onPress={() => publish('draft')}
          className="mt-2 items-center rounded-full px-4 py-3"
        >
          <Text className="font-sans text-sm font-semibold text-ink-dark/50">
            {t('upload.saveDraft')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  );
}
