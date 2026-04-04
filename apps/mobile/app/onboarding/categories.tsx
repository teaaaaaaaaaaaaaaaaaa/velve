import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const CATEGORY_OPTIONS = [
  { id: 'Tops', label: 'Tops', icon: 'shirt-outline' },
  { id: 'Haljine', label: 'Haljine', icon: 'woman-outline' },
  { id: 'Pantalone', label: 'Pantalone', icon: 'git-compare-outline' },
  { id: 'Suknje', label: 'Suknje', icon: 'filter-outline' },
  { id: 'Jakne', label: 'Jakne', icon: 'shield-outline' },
  { id: 'Džemperi', label: 'Džemperi', icon: 'snow-outline' },
  { id: 'Patike', label: 'Patike', icon: 'tennisball-outline' },
  { id: 'Cipele', label: 'Cipele', icon: 'footsteps-outline' },
  { id: 'Torbe', label: 'Torbe', icon: 'bag-handle-outline' },
  { id: 'Aksesoari', label: 'Aksesoari', icon: 'watch-outline' },
  { id: 'Nakit', label: 'Nakit', icon: 'diamond-outline' },
  { id: 'Kape', label: 'Kape', icon: 'bonfire-outline' },
]

export default function CategoriesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const handleContinue = () => {
    if (selectedCategories.length === 0) return

    router.push({
      pathname: '/onboarding/brands',
      params: {
        ...params,
        categories: JSON.stringify(selectedCategories),
      },
    })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />

      {/* Header with Back Button */}
      <View className="px-6 pt-16 pb-4">
        <TouchableOpacity
          onPress={handleBack}
          className="mb-4 w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#2B2A2B" />
        </TouchableOpacity>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-ink-dark font-sans text-sm">Korak 3 od 5</Text>
        </View>
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '40%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-3xl font-display text-ink-dark mb-3">
            Koje kategorije nosiš najčešće?
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 mb-2">
            Izaberi kategorije koje te interesuju. Možeš izabrati više opcija.
          </Text>
          <Text className="text-base font-sans text-ink-dark/60 text-center mb-8">
            Ovo nam pomaže da pronađemo najbolje ponude za tebe. 🎯
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {CATEGORY_OPTIONS.map((category) => {
              const isSelected = selectedCategories.includes(category.id)
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  className={`flex-row items-center px-5 py-4 rounded-2xl border-2 ${
                    isSelected
                      ? 'bg-brand-accent-deep border-brand-accent-deep'
                      : 'bg-base-canvas border-ink-dark/20'
                  }`}
                  style={{ minWidth: '47%' }}
                >
                  <Ionicons
                    name={category.icon as any}
                    size={24}
                    color={isSelected ? '#F6F8ED' : '#2B2A2B'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`font-sans text-base font-medium ${
                      isSelected ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {category.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#CBDA63"
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View className="px-6 pb-12 pt-4">
        <TouchableOpacity
          className={`rounded-full py-4 items-center ${
            selectedCategories.length > 0
              ? 'bg-brand-accent-deep'
              : 'bg-ink-dark/20'
          }`}
          onPress={handleContinue}
          disabled={selectedCategories.length === 0}
        >
          <Text className={`font-sans text-lg font-semibold ${selectedCategories.length > 0 ? 'text-base-canvas' : 'text-ink-dark/40'}`}>
            Nastavi
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
