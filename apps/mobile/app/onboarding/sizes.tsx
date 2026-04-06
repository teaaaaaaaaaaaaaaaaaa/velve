import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function SizesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [clothingSize, setClothingSize] = useState<string>('')
  const [shoeSize, setShoeSize] = useState('')

  const isValid = clothingSize && shoeSize && parseInt(shoeSize) >= 36 && parseInt(shoeSize) <= 47

  const handleContinue = () => {
    if (!isValid) return

    router.push({
      pathname: '/onboarding/location',
      params: {
        ...params,
        clothingSize,
        shoeSize,
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
          <Text className="text-ink-dark font-sans text-sm">Korak 4 od 5</Text>
        </View>
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '80%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-3xl font-display text-ink-dark mb-3">
            Koje su tvoje veličine?
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 mb-8">
            Ovo nam pomaže da ti prikažemo komade koji ti odgovaraju.
          </Text>

          {/* Clothing Size */}
          <View className="mb-8">
            <Text className="text-lg font-sans font-semibold text-ink-dark mb-4">
              Veličina odeće
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {CLOTHING_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() => setClothingSize(size)}
                  className={`items-center justify-center py-5 rounded-2xl border-2 ${
                    clothingSize === size
                      ? 'bg-brand-accent-deep border-brand-accent-deep'
                      : 'bg-base-canvas border-ink-dark/20'
                  }`}
                  style={{ width: '30%' }}
                >
                  <Text
                    className={`font-sans text-2xl font-bold ${
                      clothingSize === size ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Shoe Size */}
          <View className="mb-8">
            <Text className="text-lg font-sans font-semibold text-ink-dark mb-4">
              Broj cipela
            </Text>
            <View className="flex-row items-center bg-surface-panel rounded-2xl border-2 border-ink-dark/20 px-5 py-4">
              <Ionicons name="footsteps-outline" size={24} color="#2B2A2B" style={{ marginRight: 12 }} />
              <TextInput
                className="flex-1 font-sans text-lg text-ink-dark"
                placeholder="npr. 42"
                placeholderTextColor="#2B2A2B66"
                value={shoeSize}
                onChangeText={(text) => {
                  // Only allow numbers
                  const cleaned = text.replace(/[^0-9]/g, '')
                  setShoeSize(cleaned)
                }}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <Text className="text-sm font-sans text-ink-dark/50 mt-2">
              Veličine od 36 do 47
            </Text>
          </View>

          {/* Info Box */}
          <View className="bg-brand-accent-light/10 border-2 border-brand-accent-light/30 rounded-2xl p-4 flex-row">
            <Ionicons name="information-circle-outline" size={24} color="#431A43" style={{ marginRight: 12 }} />
            <View className="flex-1">
              <Text className="text-sm font-sans text-ink-dark/70 leading-relaxed">
                Ove informacije su obavezne kako bismo ti prikazali najbolje rezultate.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View className="px-6 pb-12 pt-4">
        <TouchableOpacity
          className={`rounded-full py-4 items-center ${
            isValid
              ? 'bg-brand-accent-deep'
              : 'bg-ink-dark/20'
          }`}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text className={`font-sans text-lg font-semibold ${isValid ? 'text-base-canvas' : 'text-ink-dark/40'}`}>
            Nastavi
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
