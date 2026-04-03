import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const SUGGESTED_BRANDS = [
  'Nike',
  'Adidas',
  'Zara',
  'H&M',
  'Pull&Bear',
  'Mango',
  'Reserved',
  'Bershka',
  'Stradivarius',
  'New Balance',
  'Converse',
  'Vans',
  'Levi\'s',
  'Tommy Hilfiger',
  'Calvin Klein',
  'Ralph Lauren',
]

export default function BrandsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [customBrand, setCustomBrand] = useState('')

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const addCustomBrand = () => {
    if (customBrand.trim() && !selectedBrands.includes(customBrand.trim())) {
      setSelectedBrands((prev) => [...prev, customBrand.trim()])
      setCustomBrand('')
    }
  }

  const handleContinue = () => {
    if (selectedBrands.length === 0) return

    router.push({
      pathname: '/onboarding/sizes',
      params: {
        ...params,
        brands: JSON.stringify(selectedBrands),
      },
    })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-base-canvas"
    >
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
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '60%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-3xl font-display text-ink-dark mb-3">
            Koji brendovi te zanimaju?
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 mb-6">
            Pomozi nam da ti prikažemo ono što voliš.
          </Text>

          {/* Custom Brand Input */}
          <View className="mb-6">
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-white border-2 border-ink-dark/20 rounded-2xl px-5 py-4 font-sans text-base text-ink-dark"
                placeholder="Dodaj svoj brend..."
                placeholderTextColor="#2B2A2B66"
                value={customBrand}
                onChangeText={setCustomBrand}
                onSubmitEditing={addCustomBrand}
                returnKeyType="done"
              />
              {customBrand.trim() && (
                <TouchableOpacity
                  onPress={addCustomBrand}
                  className="ml-3 bg-brand-highlight rounded-full p-3"
                >
                  <Ionicons name="add" size={24} color="#2B2A2B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Selected Brands */}
          {selectedBrands.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-sans text-ink-dark/70 mb-3">
                Izabrano ({selectedBrands.length})
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {selectedBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    onPress={() => toggleBrand(brand)}
                    className="flex-row items-center bg-brand-accent-deep px-4 py-2 rounded-full"
                  >
                    <Text className="text-base-canvas font-sans text-sm font-medium mr-2">
                      {brand}
                    </Text>
                    <Ionicons name="close-circle" size={18} color="#F6F8ED" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Suggested Brands */}
          <Text className="text-sm font-sans text-ink-dark/70 mb-3">
            Popularni brendovi
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTED_BRANDS.filter((b) => !selectedBrands.includes(b)).map((brand) => (
              <TouchableOpacity
                key={brand}
                onPress={() => toggleBrand(brand)}
                className="bg-base-canvas border-2 border-ink-dark/20 px-4 py-2 rounded-full"
              >
                <Text className="text-ink-dark font-sans text-sm font-medium">
                  {brand}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View className="px-6 pb-12 pt-4 bg-base-canvas">
        <TouchableOpacity
          className={`rounded-full py-4 items-center ${
            selectedBrands.length > 0
              ? 'bg-brand-accent-deep'
              : 'bg-ink-dark/20'
          }`}
          onPress={handleContinue}
          disabled={selectedBrands.length === 0}
        >
          <Text className={`font-sans text-lg font-semibold ${selectedBrands.length > 0 ? 'text-base-canvas' : 'text-ink-dark/40'}`}>
            Nastavi
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
