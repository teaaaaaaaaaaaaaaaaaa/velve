import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import client from '@/api/client';
import { BrandBackground } from '@/components/BrandBackground';
import { colors } from '@/design/tokens';
import { Alert } from '@/lib/velveAlert';
import { markBodyScanSkippedThisSession } from '@/lib/vtoSession';

type BodyScanRouteParams = {
  returnTo?: string | string[];
  itemId?: string | string[];
  itemIds?: string | string[];
  mode?: string | string[];
};

type BodyScanPayload = {
  exists: boolean;
  url: string | null;
};

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default function BodyScanIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<BodyScanRouteParams>();
  const [bodyScan, setBodyScan] = useState<BodyScanPayload>({ exists: false, url: null });
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const returnTo = normalizeParam(params.returnTo);
  const itemId = normalizeParam(params.itemId);
  const itemIds = normalizeParam(params.itemIds);
  const mode = normalizeParam(params.mode);

  useEffect(() => {
    let active = true;

    client
      .get('/api/users/body-scan')
      .then((response) => {
        if (!active) return;
        setBodyScan(response.data?.data || { exists: false, url: null });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoadingExisting(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const cameraParams = {
    ...(returnTo ? { returnTo } : {}),
    ...(itemId ? { itemId } : {}),
    ...(itemIds ? { itemIds } : {}),
    ...(mode ? { mode } : {}),
  };

  function skipBodyScan() {
    markBodyScanSkippedThisSession();
    router.replace('/vto/hub');
  }

  async function deleteBodyScan() {
    Alert.alert('Obrisi body scan', 'Ovaj body scan vise nece biti dostupan za Virtual Try-On.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Obrisi',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await client.delete('/api/users/body-scan');
            setBodyScan({ exists: false, url: null });
            Alert.alert('Obrisano', 'Body scan je uklonjen sa naloga.');
          } catch (error: any) {
            Alert.alert(
              'Brisanje nije uspelo',
              error?.response?.data?.error || error?.message || 'Pokusaj ponovo.'
            );
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="flex-1 justify-between px-5 pb-10" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <View className="mb-4 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            >
              <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={skipBodyScan}
              className="rounded-full bg-surface-panel px-4 py-2.5"
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark/65">Preskoci</Text>
            </TouchableOpacity>
          </View>
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            Ritual skenera
          </Text>
          <Text className="mt-3 font-display text-4xl text-ink-dark">
            Da bi isprobao arhiv, potreban nam je tvoj digitalni duplikat.
          </Text>
          <Text className="mt-4 font-sans text-sm leading-7 text-ink-dark/65">
            Napravi jednu jasnu fotografiju celog tela. Najbolje radi kada stanes ispred svetle,
            mirne pozadine i ostavis malo prostora iznad glave i oko ramena. Posle cuvanja
            automatski cistimo pozadinu za bolji try-on.
          </Text>
        </View>

        <View className="rounded-[32px] bg-surface-panel px-5 py-6">
          <Text className="font-display text-3xl text-ink-dark">Priprema</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
            Koristicemo sistemsku kameru ili sliku iz galerije, pa ces prvo videti preview. Ako
            fotografija nije dobra, samo je ponovi pre cuvanja.
          </Text>
        </View>

        {loadingExisting ? (
          <View className="rounded-[28px] bg-surface-panel px-5 py-5">
            <ActivityIndicator size="small" color={colors.accentDeep} />
          </View>
        ) : bodyScan.exists ? (
          <View className="rounded-[28px] bg-surface-panel px-5 py-5">
            <Text className="font-display text-3xl text-ink-dark">Postojeci body scan</Text>
            <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/65">
              Vec imas sacuvan body scan. Mozes da snimis novi ili da obrises postojeci.
            </Text>
            <TouchableOpacity
              onPress={deleteBodyScan}
              disabled={deleting}
              className="mt-4 items-center rounded-full border border-signal-danger/25 bg-base-canvas px-4 py-4"
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.inkDark} />
              ) : (
                <Text className="font-sans text-base font-semibold text-ink-dark">
                  Obrisi body scan
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vto/body-scan-camera', params: cameraParams })}
          className="items-center rounded-full bg-brand-accent-deep px-4 py-4"
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">Zapocni skener</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
