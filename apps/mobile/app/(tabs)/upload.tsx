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
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import client from '@/api/client'

type Condition = 'new' | 'like_new' | 'good' | 'fair'
type ListingType = 'trade' | 'sell' | 'both'

const CATEGORIES = [
  'Haljine',
  'Majice',
  'Pantalone',
  'Jakne',
  'Obuca',
  'Dodaci',
]

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'Novo' },
  { value: 'like_new', label: 'Kao novo' },
  { value: 'good', label: 'Dobro stanje' },
  { value: 'fair', label: 'Prihvatljivo' },
]

const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'trade', label: 'Razmeni' },
  { value: 'sell', label: 'Proda' },
  { value: 'both', label: 'Oboje' },
]

const TRADE_FOR_CHIPS = [
  'Bilo šta',
  'Majice',
  'Jakne',
  'Pantalone',
  'Haljine',
  'Obuća',
  'Dodaci',
]

export default function UploadScreen() {
  const router = useRouter()

  // Image state
  const [images, setImages] = useState<string[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])

  // Listing type state
  const [listingType, setListingType] = useState<ListingType>('trade')
  const [price, setPrice] = useState('')
  const [tradeFor, setTradeFor] = useState('')
  const [selectedTradeForChip, setSelectedTradeForChip] = useState('')
  const [tradeForFreeText, setTradeForFreeText] = useState('')

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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTradeForChip = (chip: string) => {
    if (selectedTradeForChip === chip) {
      setSelectedTradeForChip('')
    } else {
      setSelectedTradeForChip(chip)
    }
  }

  const getTradeForValue = (): string => {
    const parts: string[] = []
    if (selectedTradeForChip && selectedTradeForChip !== 'Bilo šta') {
      parts.push(selectedTradeForChip)
    } else if (selectedTradeForChip === 'Bilo šta') {
      return 'Bilo šta'
    }
    if (tradeForFreeText.trim()) {
      parts.push(tradeForFreeText.trim())
    }
    return parts.join(', ')
  }

  const pickImageFromCamera = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit', 'Mozete dodati maksimalno 5 slika')
      return
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup kameri')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
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
      Alert.alert('Limit', 'Mozete dodati maksimalno 5 slika')
      return
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Dozvola', 'Potrebna je dozvola za pristup galeriji')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = []
    for (const imageUri of images) {
      const formData = new FormData()
      const filename = imageUri.split('/').pop() || 'image.jpg'
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : 'image/jpeg'
      formData.append('image', { uri: imageUri, name: filename, type } as any)
      const uploadRes = await client.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      if (uploadRes.data?.ok && uploadRes.data?.data?.url) {
        urls.push(uploadRes.data.data.url)
      } else {
        throw new Error('Upload slike nije uspeo')
      }
    }
    return urls
  }

  const handleGenerateDescription = async () => {
    if (images.length === 0) {
      Alert.alert('Greska', 'Dodajte bar jednu sliku')
      return
    }
    if (!category) {
      Alert.alert('Greska', 'Izaberite kategoriju')
      return
    }

    try {
      setIsGeneratingAI(true)

      // Korak 1: Upload slika (uvek)
      const urls = await uploadImages()
      setUploadedUrls(urls)

      // Korak 2: AI opis (opcionalan — ako ne radi, ide na ručni unos)
      try {
        const aiRes = await client.post('/api/ai/generate-description', {
          category,
          brand: brand || undefined,
          size: size || undefined,
          condition,
          color: color || undefined,
          language: 'sr',
        }, { timeout: 60000 })

        if (aiRes.data?.ok && aiRes.data?.data) {
          setTitle(aiRes.data.data.title || '')
          setDescription(aiRes.data.data.description || '')
        }
      } catch {
        // AI server nije dostupan — samo nastavlja bez opisa
      }

      setShowAIFields(true)
    } catch (error: any) {
      console.error('Upload error:', error)
      Alert.alert('Greska', error.response?.data?.message || error.message || 'Greska pri upload-u slika')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleFinalSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Greska', 'Naslov je obavezan')
      return
    }
    if (!description.trim()) {
      Alert.alert('Greska', 'Opis je obavezan')
      return
    }
    if ((listingType === 'sell' || listingType === 'both') && !price.trim()) {
      Alert.alert('Greska', 'Cena je obavezna za prodaju')
      return
    }

    try {
      setIsSubmitting(true)

      // If images weren't uploaded yet (manual mode), upload now
      let finalUrls = uploadedUrls
      if (finalUrls.length === 0 && images.length > 0) {
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
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000,
          })

          if (uploadRes.data?.ok && uploadRes.data?.data?.url) {
            finalUrls.push(uploadRes.data.data.url)
          }
        }
      }

      const finalTradeFor = getTradeForValue()

      const body: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        brand: brand || undefined,
        size: size || undefined,
        condition,
        images: finalUrls,
        listingType,
      }

      if (listingType === 'sell' || listingType === 'both') {
        body.price = Number(price)
      }

      if ((listingType === 'trade' || listingType === 'both') && finalTradeFor) {
        body.tradeFor = finalTradeFor
      }

      const res = await client.post('/api/items', body)

      if (res.data?.ok) {
        Alert.alert('Uspeh', 'Item je uspesno dodat!', [
          {
            text: 'OK',
            onPress: () => {
              resetForm()
              router.push('/(tabs)/feed')
            },
          },
        ])
      } else {
        throw new Error('Neuspesan submit')
      }
    } catch (error: any) {
      console.error('Final submit error:', error)
      Alert.alert(
        'Greska',
        error.response?.data?.message || error.message || 'Greska pri upload-u'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setImages([])
    setUploadedUrls([])
    setListingType('trade')
    setPrice('')
    setTradeFor('')
    setSelectedTradeForChip('')
    setTradeForFreeText('')
    setCategory('')
    setBrand('')
    setSize('')
    setCondition('good')
    setColor('')
    setTitle('')
    setDescription('')
    setShowAIFields(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="p-4 pt-14 pb-8">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="font-display text-ink-dark text-2xl">
              Dodaj novi item
            </Text>
            {(images.length > 0 || category || brand || title) && (
              <TouchableOpacity onPress={resetForm}>
                <Text className="font-sans text-brand-accent-deep text-sm">Resetuj</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Step indicator */}
          <View className="flex-row mb-6">
            <View className={`flex-1 h-1 rounded-full mr-1 ${!showAIFields ? 'bg-brand-accent-deep' : 'bg-brand-accent-light'}`} />
            <View className={`flex-1 h-1 rounded-full ml-1 ${showAIFields ? 'bg-brand-accent-deep' : 'bg-brand-accent-light'}`} />
          </View>

          {!showAIFields ? (
            <>
              {/* Listing Type Selector */}
              <View className="mb-6">
                <Text className="font-sans text-ink-dark text-sm mb-3">
                  Tip oglasa *
                </Text>
                <View className="flex-row gap-2">
                  {LISTING_TYPES.map((lt) => (
                    <TouchableOpacity
                      key={lt.value}
                      onPress={() => setListingType(lt.value)}
                      className={`flex-1 py-3 rounded-full items-center ${
                        listingType === lt.value
                          ? 'bg-brand-accent-deep'
                          : 'border border-ink-dark'
                      }`}
                      disabled={isGeneratingAI}
                    >
                      <Text
                        className={`font-sans font-semibold ${
                          listingType === lt.value ? 'text-base-canvas' : 'text-ink-dark'
                        }`}
                      >
                        {lt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Price — only for sell or both */}
              {(listingType === 'sell' || listingType === 'both') && (
                <View className="mb-4">
                  <Text className="font-sans text-ink-dark text-sm mb-2">Cena *</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="Cena u EUR"
                    keyboardType="numeric"
                    className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                    placeholderTextColor="#2B2A2B66"
                    editable={!isGeneratingAI}
                  />
                </View>
              )}

              {/* Trade For — only for trade or both */}
              {(listingType === 'trade' || listingType === 'both') && (
                <View className="mb-4">
                  <Text className="font-sans text-ink-dark text-sm mb-2">Za šta razmeniš</Text>
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {TRADE_FOR_CHIPS.map((chip) => (
                      <TouchableOpacity
                        key={chip}
                        onPress={() => handleTradeForChip(chip)}
                        className={`px-4 py-2 rounded-full ${
                          selectedTradeForChip === chip
                            ? 'bg-brand-highlight'
                            : 'border border-ink-dark'
                        }`}
                        disabled={isGeneratingAI}
                      >
                        <Text
                          className={`font-sans text-sm ${
                            selectedTradeForChip === chip ? 'text-ink-dark font-semibold' : 'text-ink-dark'
                          }`}
                        >
                          {chip}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={tradeForFreeText}
                    onChangeText={setTradeForFreeText}
                    placeholder="Ili napiši slobodan tekst (opciono)..."
                    className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                    placeholderTextColor="#2B2A2B66"
                    editable={!isGeneratingAI}
                  />
                </View>
              )}

              {/* Image Picker Section */}
              <View className="mb-6">
                <Text className="font-sans text-ink-dark text-sm mb-3">
                  Slike ({images.length}/5)
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
                          <Text className="text-base-canvas font-bold">x</Text>
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
                <Text className="font-sans text-ink-dark text-sm mb-2">Brand</Text>
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
                <Text className="font-sans text-ink-dark text-sm mb-2">Velicina</Text>
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
                <Text className="font-sans text-ink-dark text-sm mb-2">Stanje</Text>
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

              {/* Generate AI Description Button */}
              <TouchableOpacity
                onPress={handleGenerateDescription}
                className={`rounded-full py-4 items-center mb-3 ${
                  isGeneratingAI ? 'bg-brand-highlight opacity-60' : 'bg-brand-highlight'
                }`}
                disabled={isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#2B2A2B" size="small" />
                    <Text className="font-sans text-ink-dark font-bold text-base ml-2">
                      AI generise opis...
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-ink-dark font-bold text-base">
                    Generisi AI opis
                  </Text>
                )}
              </TouchableOpacity>

              {/* Manual entry option */}
              <TouchableOpacity
                onPress={async () => {
                  if (images.length === 0) {
                    Alert.alert('Greska', 'Dodajte bar jednu sliku')
                    return
                  }
                  if (!category) {
                    Alert.alert('Greska', 'Izaberite kategoriju')
                    return
                  }
                  try {
                    setIsGeneratingAI(true)
                    const urls = await uploadImages()
                    setUploadedUrls(urls)
                    setShowAIFields(true)
                  } catch (error: any) {
                    Alert.alert('Greska', error.response?.data?.message || error.message || 'Greska pri upload-u slika')
                  } finally {
                    setIsGeneratingAI(false)
                  }
                }}
                className="rounded-full py-4 items-center border border-ink-dark"
                disabled={isGeneratingAI}
              >
                <Text className="font-sans text-ink-dark text-base">
                  Napisi rucno
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Preview uploaded images */}
              {(uploadedUrls.length > 0 || images.length > 0) && (
                <View className="mb-4">
                  <Text className="font-sans text-ink-dark text-sm mb-2">Slike</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(uploadedUrls.length > 0 ? uploadedUrls : images).map((uri, index) => (
                      <Image
                        key={index}
                        source={{ uri }}
                        className="w-20 h-24 rounded-lg"
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Summary chips */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                <View className="bg-brand-accent-light px-3 py-1 rounded-full">
                  <Text className="font-sans text-ink-dark text-xs">{category}</Text>
                </View>
                {brand ? (
                  <View className="bg-brand-accent-light px-3 py-1 rounded-full">
                    <Text className="font-sans text-ink-dark text-xs">{brand}</Text>
                  </View>
                ) : null}
                {size ? (
                  <View className="bg-brand-accent-light px-3 py-1 rounded-full">
                    <Text className="font-sans text-ink-dark text-xs">{size}</Text>
                  </View>
                ) : null}
                <View className="bg-brand-accent-light px-3 py-1 rounded-full">
                  <Text className="font-sans text-ink-dark text-xs">
                    {CONDITIONS.find(c => c.value === condition)?.label}
                  </Text>
                </View>
                <View className="bg-brand-highlight px-3 py-1 rounded-full">
                  <Text className="font-sans text-ink-dark text-xs font-semibold">
                    {LISTING_TYPES.find(lt => lt.value === listingType)?.label}
                  </Text>
                </View>
              </View>

              {/* Title */}
              <View className="mb-4">
                <Text className="font-sans text-ink-dark text-sm mb-2">Naslov *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Unesi naslov..."
                  className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                  placeholderTextColor="#2B2A2B66"
                  editable={!isSubmitting}
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="font-sans text-ink-dark text-sm mb-2">Opis *</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Unesi opis..."
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark min-h-[120px]"
                  placeholderTextColor="#2B2A2B66"
                  editable={!isSubmitting}
                />
              </View>

              {/* Price in step 2 (if sell or both) */}
              {(listingType === 'sell' || listingType === 'both') && (
                <View className="mb-4">
                  <Text className="font-sans text-ink-dark text-sm mb-2">Cena *</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="Cena u EUR"
                    keyboardType="numeric"
                    className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                    placeholderTextColor="#2B2A2B66"
                    editable={!isSubmitting}
                  />
                </View>
              )}

              {/* TradeFor in step 2 (if trade or both) */}
              {(listingType === 'trade' || listingType === 'both') && (
                <View className="mb-6">
                  <Text className="font-sans text-ink-dark text-sm mb-2">Za šta razmeniš</Text>
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {TRADE_FOR_CHIPS.map((chip) => (
                      <TouchableOpacity
                        key={chip}
                        onPress={() => handleTradeForChip(chip)}
                        className={`px-4 py-2 rounded-full ${
                          selectedTradeForChip === chip
                            ? 'bg-brand-highlight'
                            : 'border border-ink-dark'
                        }`}
                        disabled={isSubmitting}
                      >
                        <Text
                          className={`font-sans text-sm ${
                            selectedTradeForChip === chip ? 'text-ink-dark font-semibold' : 'text-ink-dark'
                          }`}
                        >
                          {chip}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={tradeForFreeText}
                    onChangeText={setTradeForFreeText}
                    placeholder="Ili napiši slobodan tekst (opciono)..."
                    className="font-sans border border-ink-dark rounded-lg px-4 py-3 text-ink-dark"
                    placeholderTextColor="#2B2A2B66"
                    editable={!isSubmitting}
                  />
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleFinalSubmit}
                className="bg-brand-accent-deep rounded-full py-4 items-center mb-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#F6F8ED" size="small" />
                    <Text className="font-sans text-base-canvas font-bold text-base ml-2">
                      Objavljujem...
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-base-canvas font-bold text-base">
                    Objavi item
                  </Text>
                )}
              </TouchableOpacity>

              {/* Back Button */}
              <TouchableOpacity
                onPress={() => {
                  setShowAIFields(false)
                  setUploadedUrls([])
                }}
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
    </KeyboardAvoidingView>
  )
}
