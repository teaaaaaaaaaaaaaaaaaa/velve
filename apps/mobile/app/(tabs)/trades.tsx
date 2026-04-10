// =============================================================
// Trade Desk — ZAKOMENTARISANO po zahtevu
// Cela logika sa trade desk, pending/active/history bucketima,
// cancel, complete, rate tokovima nam trenutno ne treba.
// Trade predlozi se sada salju direktno iz item details
// i prihvataju/odbijaju u chatu (accept/reject dugmici).
// =============================================================

import { View, Text } from 'react-native'

export default function TradesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base-canvas px-6">
      <Text className="text-center font-sans text-sm text-ink-dark/50">
        Trade Desk je privremeno iskljucen.
      </Text>
    </View>
  )
}

/*
--- ORIGINAL TRADE DESK CODE ---
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
... (see git history for full original code)
*/
