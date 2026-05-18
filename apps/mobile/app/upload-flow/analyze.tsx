import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/velveAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';
import { analyzeLocalImage } from '@/lib/imageRequests';

type AnalysisPayload = {
  ready: boolean;
  messages: string[];
  checks: {
    lighting: { ok: boolean };
    framing: { ok: boolean };
    contrast: { ok: boolean };
  };
};

function CheckRow({
  label,
  ok,
  okLabel,
  adjustLabel,
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  adjustLabel: string;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-[22px] bg-surface-panel px-4 py-4">
      <Text className="font-sans text-sm text-ink-dark">{label}</Text>
      <View
        className={`rounded-full px-3 py-1.5 ${ok ? 'bg-brand-highlight' : 'bg-brand-accent-light/35'}`}
      >
        <Text className="font-sans text-xs font-semibold text-ink-dark">
          {ok ? okLabel : adjustLabel}
        </Text>
      </View>
    </View>
  );
}

export default function CleanCutAnalyzeScreen() {
  const router = useRouter();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const scan = useRef(new Animated.Value(0)).current;
  const hasAutoNavigated = useRef(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scan]);

  useEffect(() => {
    if (!imageUri) {
      router.replace('/upload-flow');
      return;
    }

    let active = true;
    (async () => {
      try {
        setLoading(true);
        const payload = await analyzeLocalImage(imageUri, '/api/ai/analyze-garment-photo');
        if (active) {
          setAnalysis(payload);
        }
      } catch (error) {
        Alert.alert(
          t('upload.analysisUnavailableTitle'),
          t('upload.analysisUnavailableDescription'),
          [{ text: t('common.close'), onPress: () => router.replace('/upload-flow') }]
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [imageUri, router, t]);

  const scanTranslate = useMemo(
    () =>
      scan.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, 150],
      }),
    [scan]
  );
  const analysisMessages = useMemo(() => {
    if (!analysis) return [];
    const next: string[] = [];
    if (!analysis.checks?.lighting?.ok) next.push(t('upload.analysisLightingHint'));
    if (!analysis.checks?.framing?.ok) next.push(t('upload.analysisFramingHint'));
    if (!analysis.checks?.contrast?.ok) next.push(t('upload.analysisContrastHint'));
    return next;
  }, [analysis, t]);

  useEffect(() => {
    if (!analysis?.ready || loading || hasAutoNavigated.current) return;

    hasAutoNavigated.current = true;

    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/upload-flow/transform',
        params: { imageUri },
      });
    }, 900);

    return () => clearTimeout(timeout);
  }, [analysis?.ready, imageUri, loading, router]);

  return (
    <SafeAreaView className="flex-1 bg-base-canvas" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-5 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
        </TouchableOpacity>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          {t('upload.analyzeEyebrow')}
        </Text>
        <Text className="mt-2 font-display text-4xl text-ink-dark">{t('upload.analyzeTitle')}</Text>

        <View className="mt-6 overflow-hidden rounded-[34px] bg-surface-panel px-3 py-3">
          <View className="overflow-hidden rounded-[28px] bg-base-canvas">
            <RemoteImage uri={imageUri} className="aspect-[3/4] w-full" contentFit="contain" />
            <Animated.View
              style={{
                top: '38%',
                transform: [{ translateY: scanTranslate }],
                opacity: 0.8,
              }}
              className="absolute left-0 right-0 h-16 bg-brand-accent-light/55"
            />
          </View>
        </View>

        <View className="mt-6 gap-3">
          <CheckRow
            label={t('upload.checkLighting')}
            ok={!!analysis?.checks?.lighting?.ok}
            okLabel={t('upload.checkOk')}
            adjustLabel={t('upload.checkAdjust')}
          />
          <CheckRow
            label={t('upload.checkFraming')}
            ok={!!analysis?.checks?.framing?.ok}
            okLabel={t('upload.checkOk')}
            adjustLabel={t('upload.checkAdjust')}
          />
          <CheckRow
            label={t('upload.checkContrast')}
            ok={!!analysis?.checks?.contrast?.ok}
            okLabel={t('upload.checkOk')}
            adjustLabel={t('upload.checkAdjust')}
          />
        </View>

        <View className="mt-5 rounded-[24px] bg-surface-panel px-4 py-4">
          {loading ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={colors.accentDeep} />
              <Text className="ml-3 flex-1 font-sans text-sm text-ink-dark/65">
                {t('upload.analysisLoading')}
              </Text>
            </View>
          ) : analysisMessages.length ? (
            analysisMessages.map((message) => (
              <Text key={message} className="mb-2 font-sans text-sm leading-6 text-ink-dark/70">
                {message}
              </Text>
            ))
          ) : (
            <Text className="font-sans text-sm leading-6 text-ink-dark/70">
              {t('upload.analysisReady')}
            </Text>
          )}
        </View>

        {analysis?.ready && !loading ? (
          <Text className="mt-4 font-sans text-sm text-ink-dark/55">
            {t('upload.analysisAutoContinue')}
          </Text>
        ) : null}

        <View className="mt-6">
          <TouchableOpacity
            disabled={!analysis?.ready || loading}
            onPress={() =>
              router.push({
                pathname: '/upload-flow/transform',
                params: { imageUri },
              })
            }
            className={`items-center rounded-full bg-brand-accent-deep px-4 py-4 ${
              analysis?.ready && !loading ? '' : 'opacity-40'
            }`}
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {t('upload.analysisCta')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
