import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BrandBackground } from '@/components/BrandBackground';
import { colors } from '@/design/tokens';

// Small, stateless presentational pieces used by the item detail screen
// (app/items/[id].tsx). Extracted verbatim — no logic changes — purely to
// shrink that screen's file size.

export function DetailInfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 rounded-[24px] bg-base-canvas px-4 py-4">
      <View className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-surface-soft">
        <Ionicons name={icon} size={17} color={colors.accentDeep} />
      </View>
      <Text className="font-sans text-[11px] uppercase text-ink-dark/45">{label}</Text>
      <Text className="mt-1 font-sans text-base font-bold text-ink-dark" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function DetailPanel({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="mt-4 rounded-[26px] bg-base-canvas px-4 py-4">
      <View className="mb-3 flex-row items-center">
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-surface-soft">
          <Ionicons name={icon} size={16} color={colors.accentDeep} />
        </View>
        <Text className="font-sans text-xs font-bold uppercase text-ink-dark/55">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function ItemDetailsSkeleton() {
  return (
    <View className="flex-1 bg-base-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <BrandBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
        <View className="px-5 pb-8 pt-14">
          <View className="mb-5 h-11 w-11 rounded-full bg-surface-panel" />
          <View className="h-[520px] overflow-hidden rounded-[34px] bg-surface-panel">
            <View className="absolute bottom-0 left-0 right-0 px-5 pb-6">
              <View className="h-5 w-28 rounded-full bg-base-canvas/80" />
              <View className="mt-3 h-10 w-56 rounded-full bg-base-canvas/80" />
              <View className="mt-3 h-4 w-40 rounded-full bg-base-canvas/70" />
            </View>
          </View>
          <View className="mt-5 rounded-[28px] bg-surface-panel px-4 py-5">
            <View className="h-5 w-32 rounded-full bg-base-canvas" />
            <View className="mt-4 h-4 w-full rounded-full bg-base-canvas" />
            <View className="mt-3 h-4 w-4/5 rounded-full bg-base-canvas" />
          </View>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {[0, 1, 2, 3].map((entry) => (
              <View
                key={entry}
                className="h-24 min-w-[46%] flex-1 rounded-[24px] bg-surface-panel"
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
