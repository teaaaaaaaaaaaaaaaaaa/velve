import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BrandBackground } from '@/components/BrandBackground'
import { colors } from '@/design/tokens'

type Condition = 'new' | 'like_new' | 'good' | 'fair'

const CATEGORIES: { value: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'Majice', icon: 'shirt-outline' },
  { value: 'Haljine', icon: 'woman-outline' },
  { value: 'Pantalone', icon: 'body-outline' },
  { value: 'Jakne', icon: 'snow-outline' },
  { value: 'Obuca', icon: 'footsteps-outline' },
  { value: 'Dodaci', icon: 'watch-outline' },
]

const CONDITIONS: { value: Condition; label: string; desc: string }[] = [
  { value: 'new', label: 'Novo', desc: 'Sa etiketom' },
  { value: 'like_new', label: 'Kao novo', desc: 'Noseno jednom' },
  { value: 'good', label: 'Dobro', desc: 'Vidljivi tragovi' },
  { value: 'fair', label: 'Prihvatljivo', desc: 'Korisceno' },
]

export default function CategoryScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { itemId } = useLocalSearchParams<{ itemId: string }>()

  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<Condition | ''>('')

  const canContinue = category && condition

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
        <Text className="font-sans text-xs text-ink-dark/40">2 / 4</Text>
      </View>

      {/* Progress bar */}
      <View className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-ink-dark/8">
        <View className="h-full w-2/4 rounded-full bg-brand-accent-deep" />
      </View>

      <View className="flex-1 px-5 pt-8">
        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Kategorija
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">
          Sta je ovo?
        </Text>

        {/* Category grid */}
        <View className="mt-6 flex-row flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              className={`items-center rounded-[22px] px-5 py-4 ${
                category === cat.value
                  ? 'bg-brand-accent-deep'
                  : 'border border-ink-dark/8 bg-surface-panel'
              }`}
              style={{ minWidth: '30%' }}
            >
              <Ionicons
                name={cat.icon}
                size={24}
                color={category === cat.value ? colors.baseCanvas : colors.accentDeep}
              />
              <Text
                className={`mt-2 font-sans text-sm font-semibold ${
                  category === cat.value ? 'text-base-canvas' : 'text-ink-dark'
                }`}
              >
                {cat.value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Condition */}
        <Text className="mt-8 font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Stanje
        </Text>
        <Text className="mt-1 font-display text-2xl text-ink-dark">
          Kako izgleda?
        </Text>

        <View className="mt-4 gap-2">
          {CONDITIONS.map((cond) => (
            <TouchableOpacity
              key={cond.value}
              onPress={() => setCondition(cond.value)}
              className={`flex-row items-center rounded-[20px] px-5 py-4 ${
                condition === cond.value
                  ? 'bg-brand-accent-deep'
                  : 'border border-ink-dark/8 bg-surface-panel'
              }`}
            >
              <View className="flex-1">
                <Text
                  className={`font-sans text-sm font-semibold ${
                    condition === cond.value ? 'text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {cond.label}
                </Text>
                <Text
                  className={`mt-0.5 font-sans text-xs ${
                    condition === cond.value ? 'text-base-canvas/70' : 'text-ink-dark/50'
                  }`}
                >
                  {cond.desc}
                </Text>
              </View>
              {condition === cond.value ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.baseCanvas} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bottom CTA */}
      <View className="px-5" style={{ paddingBottom: insets.bottom + 12 }}>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={() =>
            router.push({
              pathname: '/upload-flow/listing',
              params: { itemId, category, condition },
            })
          }
          className={`items-center rounded-full bg-brand-accent-deep px-4 py-4 ${
            canContinue ? '' : 'opacity-40'
          }`}
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            Nastavi
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
