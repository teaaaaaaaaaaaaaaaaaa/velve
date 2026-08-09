import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import client from '@/api/client';
import { BrandBackground } from '@/components/BrandBackground';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { RemoteImage } from '@/components/RemoteImage';
import { VelveTextInput } from '@/components/VelveTextInput';
import { colors } from '@/design/tokens';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { Alert } from '@/lib/velveAlert';

type TradeUser = {
  _id: string;
  displayName?: string;
  photoURL?: string;
};

type TradeRecord = {
  _id: string;
  canRate?: boolean;
  counterpart?: TradeUser;
  completedAt?: string;
};

export default function RateTradeScreen() {
  const router = useRouter();
  const { tradeId } = useLocalSearchParams<{ tradeId?: string }>();
  const [trade, setTrade] = useState<TradeRecord | null>(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadTrade = useCallback(async () => {
    const response = await client.get('/api/trades/history');
    if (response.data.ok) {
      const nextTrade = (response.data.data || []).find(
        (entry: TradeRecord) => entry._id === tradeId
      );
      setTrade(nextTrade || null);
    }
  }, [tradeId]);

  useEffect(() => {
    loadTrade().finally(() => setLoading(false));
  }, [loadTrade]);

  const submitRating = useCallback(async () => {
    if (!tradeId || submitting) return;
    try {
      setSubmitting(true);
      await client.post(`/api/trades/${tradeId}/rate`, {
        rating,
        review: review.trim(),
      });
      Alert.alert('Hvala', 'Ocena je sacuvana.', [
        { text: 'U redu', onPress: () => router.replace('/trade-archive') },
      ]);
    } catch (error) {
      Alert.alert('Greska', getApiErrorMessage(error, 'Ocena trenutno nije sacuvana.'));
    } finally {
      setSubmitting(false);
    }
  }, [rating, review, router, submitting, tradeId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator color={colors.accentDeep} />
      </View>
    );
  }

  const userName = trade?.counterpart?.displayName || 'korisnika';

  return (
    <KeyboardAwareScreen className="bg-base-canvas">
      <BrandBackground />
      <View className="flex-1 px-5 pb-8 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-6 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
        </TouchableOpacity>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Trust signal
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">Oceni razmenu</Text>
        <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/60">
          Ocena pomaze drugim korisnicima da znaju sa kim ulaze u razmenu.
        </Text>

        <View className="mt-8 items-center rounded-[30px] bg-surface-panel px-5 py-6">
          {trade?.counterpart?.photoURL ? (
            <RemoteImage uri={trade.counterpart.photoURL} className="h-20 w-20 rounded-full" />
          ) : (
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-accent-light/35">
              <Text className="font-display text-3xl text-brand-accent-deep">
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="mt-4 text-center font-sans text-base font-semibold text-ink-dark">
            Kako je prosla razmena sa {userName}?
          </Text>

          {!trade || !trade.canRate ? (
            <View className="mt-5 rounded-[22px] bg-base-canvas px-4 py-4">
              <Text className="text-center font-sans text-sm text-ink-dark/60">
                Ovaj trade je vec ocenjen ili nije spreman za ocenjivanje.
              </Text>
            </View>
          ) : (
            <>
              <View className="mt-6 flex-row gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <TouchableOpacity key={value} onPress={() => setRating(value)} className="p-1">
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={34}
                      color={value <= rating ? colors.highlight : colors.mutedText}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <VelveTextInput
                value={review}
                onChangeText={setReview}
                placeholder="Dodaj kratak komentar (opciono)"
                multiline
                maxLength={300}
                textAlignVertical="top"
                className="mt-6 min-h-[130px] w-full rounded-[22px] bg-base-canvas px-4 py-4 font-sans text-sm leading-6 text-ink-dark"
              />
              <Text className="mt-2 self-end font-sans text-xs text-ink-dark/35">
                {review.length}/300
              </Text>

              <TouchableOpacity
                onPress={submitRating}
                disabled={submitting}
                className="mt-5 w-full items-center rounded-full bg-brand-accent-deep px-4 py-4"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.baseCanvas} />
                ) : (
                  <Text className="font-sans text-base font-semibold text-base-canvas">
                    Sacuvaj ocenu
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAwareScreen>
  );
}
