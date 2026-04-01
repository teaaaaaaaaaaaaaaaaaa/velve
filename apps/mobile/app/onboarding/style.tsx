import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'

const STYLE_OPTIONS = [
  { id: 'casual', label: 'Casual', icon: 'shirt-outline' },
  { id: 'street', label: 'Street', icon: 'flash-outline' },
  { id: 'vintage', label: 'Vintage', icon: 'time-outline' },
  { id: 'luxury', label: 'Luxury', icon: 'diamond-outline' },
  { id: 'sportswear', label: 'Sportswear', icon: 'basketball-outline' },
  { id: 'minimalist', label: 'Minimalist', icon: 'remove-outline' },
  { id: 'bohemian', label: 'Bohemian', icon: 'flower-outline' },
  { id: 'grunge', label: 'Grunge', icon: 'skull-outline' },
]

export default function StyleScreen() {
  const router = useRouter()
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleContinue = async () => {
    await AsyncStorage.setItem('onboarding_styles', JSON.stringify(selectedStyles))
    router.push('/onboarding/brands')
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
          <Text className="text-ink-dark font-sans text-sm">Korak 2 od 5</Text>
        </View>
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '40%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-3xl font-display text-ink-dark mb-3">
            Kakav je tvoj stil?
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 mb-8">
            Izaberi stilove koji te zanimaju. Možeš izabrati više opcija.
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {STYLE_OPTIONS.map((style) => {
              const isSelected = selectedStyles.includes(style.id)
              return (
                <TouchableOpacity
                  key={style.id}
                  onPress={() => toggleStyle(style.id)}
                  className={`flex-row items-center px-5 py-4 rounded-2xl border-2 ${
                    isSelected
                      ? 'bg-brand-accent-deep border-brand-accent-deep'
                      : 'bg-base-canvas border-ink-dark/20'
                  }`}
                  style={{ minWidth: '47%' }}
                >
                  <Ionicons
                    name={style.icon as any}
                    size={24}
                    color={isSelected ? '#F6F8ED' : '#2B2A2B'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`font-sans text-base font-medium ${
                      isSelected ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {style.label}
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

      {/* CTA Buttons */}
      <View className="px-6 pb-12 pt-4">
        <TouchableOpacity
          className={`rounded-full py-4 items-center ${
            selectedStyles.length > 0
              ? 'bg-brand-accent-deep'
              : 'bg-ink-dark/20'
          }`}
          onPress={handleContinue}
          disabled={selectedStyles.length === 0}
        >
          <Text className="text-base-canvas font-sans text-lg font-semibold">
            Nastavi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 py-3 items-center"
          onPress={() => router.push('/onboarding/brands')}
        >
          <Text className="text-ink-dark/50 font-sans text-sm">
            Preskoči
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
