import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { BrandBackground } from '@/components/BrandBackground';

type BodyScanReadyRouteParams = {
  returnTo?: string | string[];
  itemId?: string | string[];
  itemIds?: string | string[];
  mode?: string | string[];
};

function normalizeParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default function BodyScanReadyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<BodyScanReadyRouteParams>();

  const returnTo = normalizeParam(params.returnTo);
  const itemId = normalizeParam(params.itemId);
  const itemIds = normalizeParam(params.itemIds);
  const mode = normalizeParam(params.mode);
  const canReturnToRender = returnTo === '/vto/render' && Boolean(itemId ?? itemIds);

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="flex-1 items-center justify-center px-5">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Tvoj digitalni duplikat
        </Text>
        <Text className="mt-3 text-center font-display text-4xl text-ink-dark">
          Tvoj digitalni duplikat je spreman.
        </Text>
        <Text className="mt-4 text-center font-sans text-sm leading-7 text-ink-dark/65">
          Body scan je sacuvan jednom i bice osnova za svaki sledeci Virtual Try-On render.
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (canReturnToRender) {
              router.replace({
                pathname: '/vto/render',
                params: {
                  ...(itemId ? { itemId } : {}),
                  ...(itemIds ? { itemIds } : {}),
                  ...(mode ? { mode } : { mode: 'quick' }),
                },
              });
              return;
            }

            router.replace('/vto/hub');
          }}
          className="mt-8 items-center rounded-full bg-brand-accent-deep px-5 py-4"
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            {canReturnToRender ? 'Nastavi na Try-On' : 'Udji u Velve arhiv'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
