import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import client from '../../api/client'
import axios from 'axios'

type Condition = 'new' | 'like_new' | 'good' | 'fair'

const CATEGORIES = [
  'Haljine',
  'Majice',
  'Pantalone',
  'Jakne',
  'Obuća',
  'Dodaci',
]

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'Novo' },
  { value: 'like_new', label: 'Kao novo' },
  { value: 'good', label: 'Dobro stanje' },
  { value: 'fair', label: 'Prihvatljivo' },
]

export default function UploadScreen() {
  const router = useRouter()

  // Image state
  const [images, setImages] = useState<string[]>([])

  // Form state
  const [category, setCategory] = useState<string>('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [condition, setCondition] = useState<Condition>('good')
  const [color, setColor] = useState('')

  // AI-generated state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showAIFields, setShowAIFields] = useState(false)

  // Loading states
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isSubmitting, setIsSubmittingFinal] = useState(false)

  // Image picker handlers
  const pickImageFromCamera = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit', 'Možete dodati maksimalno 5 slika')
      return
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup kameri')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri])
    }
  }

  const pickImageFromGallery = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit', 'Možete dodati maksimalno 5 slika')
      return
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup galeriji')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
    })

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri)
      setImages([...images, ...newImages].slice(0, 5))
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  // Validation & Submit Flow
  const handleGenerateDescription = async () => {
    // Validacija
    if (images.length === 0) {
      Alert.alert('Greška', 'Dodajte bar jednu sliku')
      return
    }
    if (!category) {
      Alert.alert('Greška', 'Izaberite kategoriju')
      return
    }

    try {
      setIsGeneratingAI(true)

      // Step 1: Upload all images to API
      const uploadedUrls: string[] = []
      for (const imageUri of images) {
        const formData = new FormData()
        const filename = imageUri.split('/').pop() || 'image.jpg'
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : 'image/jpeg'

        formData.append('image', {
          uri: imageUri,
          name: filename,
          type,
        } as any)

        const uploadRes = await client.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        if (uploadRes.data?.ok && uploadRes.data?.url) {
          uploadedUrls.push(uploadRes.data.url)
        } else {
          throw new Error('Upload slike nije uspeo')
        }
      }

      // Step 2: Generate AI description
      const aiRes = await axios.post(
        'http://localhost:8000/generate-description',
        {
          category,
          brand: brand || undefined,
          size: size || undefined,
          condition,
          color: color || undefined,
          language: 'sr',
        }
      )

      if (aiRes.data?.title && aiRes.data?.description) {
        setTitle(aiRes.data.title)
        setDescription(aiRes.data.description)
        setShowAIFields(true)
        // Store uploaded URLs for final submit
        setImages(uploadedUrls)
      } else {
        throw new Error('AI nije generisao opis')
      }
    } catch (error: any) {
      console.error('Generate description error:', error)
      Alert.alert(
        'Greška',
        error.response?.data?.message ||
          error.message ||
          'Greška pri generisanju opisa'
      )
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleFinalSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Greška', 'Naslov i opis su obavezni')
      return
    }

    try {
      setIsSubmittingFinal(true)

      const res = await client.post('/api/items', {
        title,
        description,
        category,
        brand: brand || undefined,
        size: size || undefined,
        condition,
        images,
      })

      if (res.data?.ok) {
        Alert.alert('Uspeh', 'Item je uspešno dodat!', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setImages([])
              setCategory('')
              setBrand('')
              setSize('')
              setCondition('good')
              setColor('')
              setTitle('')
              setDescription('')
              setShowAIFields(false)
              // Navigate to feed
              router.push('/(tabs)/feed')
            },
          },
        ])
      } else {
        throw new Error('Neuspešan submit')
      }
    } catch (error: any) {
      console.error('Final submit error:', error)
      Alert.alert(
        'Greška',
        error.response?.data?.message || error.message || 'Greška pri upload-u'
      )
    } finally {
      setIsSubmittingFinal(false)
    }
  }

  return (
    <ScrollView className="flex-1 bg-base-canvas">
      <View className="p-4 pb-8">
        {/* Header */}
        <Text className="font-display text-ink-dark text-2xl mb-6">
          Dodaj novi item
        </Text>

        {/* Image Picker Section */}
        {!showAIFields && (
          <>
            <View className="mb-6">
              <Text className="font-sans text-ink-dark text-sm mb-3">
                Slike (do 5)
              </Text>
              <View className="flex-row gap-3 mb-3">
                <TouchableOpacity
                  onPress={pickImageFromCamera}
                  className="flex-1 bg-brand-accent-deep rounded-full py-4 items-center"
                  disabled={isGeneratingAI}
                >
                  <Text className="font-sans text-base-canvas font-semibold">
                    Kamera
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickImageFromGallery}
                  className="flex-1 border border-ink-dark rounded-full py-4 items-center"
                  disabled={isGeneratingAI}
                >
                  <Text className="font-sans text-ink-dark font-semibold">
                    Galerija
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Image Thumbnails */}
              {images.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
                  {images.map((uri, index) => (
                    <View key={index} className="relative">
                      <Image
                        source={{ uri }}
                        className="w-20 h-24 rounded-lg"
                        resizeMode="cover"
                      />
                      {index === 0 && (
                        <View className="absolute top-1 left-1 bg-brand-highlight px-2 py-0.5 rounded">
                          <Text className="font-sans text-ink-dark text-xs font-bold">
                            Glavna
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-ink-dark rounded-full w-6 h-6 items-center justify-center"
                      >
                        <Text className="text-base-canvas font-bold">×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Category Picker */}
            <View className="mb-4">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Kategorija *
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full ${
                      category === cat
                        ? 'bg-brand-accent-deep'
                        : 'border border-ink-dark'
                    }`}
                    disabled={isGeneratingAI}
                  >
                    <Text
                      className={`font-sans ${
                        category === cat ? 'text-base-canvas' : 'text-ink-dark'
                      }`}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Brand */}
            <View className="mb-4">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Brand
              </Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Npr. Zara, H&M..."
                className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                placeholderTextColor="#2B2A2B66"
                editable={!isGeneratingAI}
              />
            </View>

            {/* Size */}
            <View className="mb-4">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Veličina
              </Text>
              <TextInput
                value={size}
                onChangeText={setSize}
                placeholder="Npr. S, M, L, 38..."
                className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                placeholderTextColor="#2B2A2B66"
                editable={!isGeneratingAI}
              />
            </View>

            {/* Condition */}
            <View className="mb-4">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Stanje
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CONDITIONS.map((cond) => (
                  <TouchableOpacity
                    key={cond.value}
                    onPress={() => setCondition(cond.value)}
                    className={`px-4 py-2 rounded-full ${
                      condition === cond.value
                        ? 'bg-brand-accent-deep'
                        : 'border border-ink-dark'
                    }`}
                    disabled={isGeneratingAI}
                  >
                    <Text
                      className={`font-sans ${
                        condition === cond.value
                          ? 'text-base-canvas'
                          : 'text-ink-dark'
                      }`}
                    >
                      {cond.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Color */}
            <View className="mb-6">
              <Text className="font-sans text-ink-dark text-sm mb-2">Boja</Text>
              <TextInput
                value={color}
                onChangeText={setColor}
                placeholder="Npr. Crna, Bela, Plava..."
                className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                placeholderTextColor="#2B2A2B66"
                editable={!isGeneratingAI}
              />
            </View>

            {/* Generate Description Button */}
            <TouchableOpacity
              onPress={handleGenerateDescription}
              className="bg-brand-highlight rounded-full py-4 items-center mb-4"
              disabled={isGeneratingAI}
            >
              {isGeneratingAI ? (
                <ActivityIndicator color="#2B2A2B" />
              ) : (
                <Text className="font-sans text-ink-dark font-bold text-base">
                  Generiši AI opis
                </Text>
              )}
            </TouchableOpacity>

            {isGeneratingAI && (
              <Text className="font-sans text-ink-dark text-center text-sm opacity-60">
                AI generiše opis...
              </Text>
            )}
          </>
        )}

        {/* AI-Generated Fields (after AI generates) */}
        {showAIFields && (
          <>
            <View className="mb-4">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Naslov *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Izmeni naslov..."
                className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                placeholderTextColor="#2B2A2B66"
                editable={!isSubmitting}
              />
            </View>

            <View className="mb-6">
              <Text className="font-sans text-ink-dark text-sm mb-2">
                Opis *
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Izmeni opis..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                placeholderTextColor="#2B2A2B66"
                editable={!isSubmitting}
              />
            </View>

            {/* Final Submit Button */}
            <TouchableOpacity
              onPress={handleFinalSubmit}
              className="bg-brand-accent-deep rounded-full py-4 items-center mb-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#F6F8ED" />
              ) : (
                <Text className="font-sans text-base-canvas font-bold text-base">
                  Objavi item
                </Text>
              )}
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              onPress={() => setShowAIFields(false)}
              className="border border-ink-dark rounded-full py-4 items-center"
              disabled={isSubmitting}
            >
              <Text className="font-sans text-ink-dark font-semibold">
                Nazad na izmenu
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  )
}
