import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import client from '@/api/client'

const SERBIAN_CITIES = [
  'Beograd',
  'Novi Sad',
  'Niš',
  'Kragujevac',
  'Subotica',
  'Zrenjanin',
  'Pančevo',
  'Čačak',
  'Kruševac',
  'Leskovac',
  'Smederevo',
  'Novi Pazar',
  'Valjevo',
  'Šabac',
  'Užice',
  'Sombor',
  'Kikinda',
  'Sremska Mitrovica',
  'Vršac',
  'Vranje',
]

export default function LocationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const submitOnboarding = async (onboardingData: {
    stylePreferences: string[]
    favoriteBrands: string[]
    sizes: { clothing: string; shoes: string }
    location: { city: string; region: string }
  }) => {
    try {
      await client.put('/api/users/me/onboarding', onboardingData)
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error
      }

      console.warn('[Onboarding] Primary onboarding route missing, retrying profile update fallback')

      try {
        await client.post('/api/users/me/onboarding', onboardingData)
      } catch (postError: any) {
        if (postError.response?.status !== 404) {
          throw postError
        }

        await client.put('/api/users/me', onboardingData)
      }
    }
  }

  const handleFinish = async () => {
    if (!selectedCity) return

    try {
      setLoading(true)

      // Parse accumulated data from params
      const styles = params.styles ? JSON.parse(params.styles as string) : []
      const brands = params.brands ? JSON.parse(params.brands as string) : []
      const clothingSize = params.clothingSize as string || ''
      const shoeSize = params.shoeSize as string || ''

      const onboardingData = {
        stylePreferences: styles,
        favoriteBrands: brands,
        sizes: {
          clothing: clothingSize,
          shoes: shoeSize,
        },
        location: {
          city: selectedCity,
          region: 'Srbija',
        },
      }

      console.log('[Onboarding] Submitting data:', onboardingData)

      // Submit to API
      await submitOnboarding(onboardingData)

      // Navigate to feed
      router.replace('/(tabs)/feed')
    } catch (error: any) {
      console.error('[Onboarding] Error:', error)
      Alert.alert(
        'Greška',
        error.response?.data?.error || 'Došlo je do greške. Pokušaj ponovo.',
        [{ text: 'OK' }]
      )
    } finally {
      setLoading(false)
    }
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
          <Text className="text-ink-dark font-sans text-sm">Korak 5 od 5</Text>
        </View>
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '100%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-8">
          <Text className="text-3xl font-display text-ink-dark mb-3">
            Gde se nalaziš?
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 mb-8">
            Pomozi nam da povežemo tebe sa ljudima iz tvog okruženja.
          </Text>

          {/* Cities Grid */}
          <View className="flex-row flex-wrap gap-3">
            {SERBIAN_CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                onPress={() => setSelectedCity(city)}
                className={`px-5 py-4 rounded-2xl border-2 ${
                  selectedCity === city
                    ? 'bg-brand-accent-deep border-brand-accent-deep'
                    : 'bg-base-canvas border-ink-dark/20'
                }`}
                style={{ minWidth: '47%' }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`font-sans text-base font-medium ${
                      selectedCity === city ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {city}
                  </Text>
                  {selectedCity === city && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#CBDA63"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Success Message */}
          {selectedCity && (
            <View className="mt-8 bg-brand-highlight/20 border-2 border-brand-highlight/40 rounded-2xl p-4 flex-row items-center">
              <Ionicons name="checkmark-circle" size={28} color="#431A43" style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Text className="text-base font-sans font-semibold text-ink-dark mb-1">
                  Skoro gotovo!
                </Text>
                <Text className="text-sm font-sans text-ink-dark/70">
                  Samo još jedan klik i spremni smo da kreneš.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View className="px-6 pb-12 pt-4">
        <TouchableOpacity
          className={`rounded-full py-4 items-center ${
            selectedCity && !loading
              ? 'bg-brand-highlight'
              : 'bg-ink-dark/20'
          }`}
          onPress={handleFinish}
          disabled={!selectedCity || loading}
        >
          {loading ? (
            <ActivityIndicator color="#2B2A2B" />
          ) : (
            <Text className={`font-sans text-lg font-bold ${selectedCity ? 'text-ink-dark' : 'text-ink-dark/40'}`}>
              Završi ✨
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
