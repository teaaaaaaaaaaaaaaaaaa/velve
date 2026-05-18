import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandBackground } from '@/components/BrandBackground';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { VelveTextInput } from '@/components/VelveTextInput';
import { colors } from '@/design/tokens';
import { useI18n } from '@/i18n';

type ListingType = 'trade' | 'sell' | 'both';

const LISTING_OPTIONS: {
  value: ListingType;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'trade',
    label: 'Razmeni',
    desc: 'Zameni za drugi komad',
    icon: 'swap-horizontal-outline',
  },
  { value: 'sell', label: 'Prodaj', desc: 'Postavi cenu', icon: 'pricetag-outline' },
  { value: 'both', label: 'Oboje', desc: 'Razmena ili prodaja', icon: 'options-outline' },
];

const POPULAR_BRANDS = [
  'Zara',
  'H&M',
  'Nike',
  'Adidas',
  'Stradivarius',
  'Bershka',
  'Pull&Bear',
  'Mango',
  'Massimo Dutti',
  'Reserved',
  'C&A',
  "Levi's",
  'Tommy Hilfiger',
  'Calvin Klein',
  'Guess',
  'New Balance',
];

const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

export default function ListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { itemId, category, condition } = useLocalSearchParams<{
    itemId: string;
    category: string;
    condition: string;
  }>();

  const [listingType, setListingType] = useState<ListingType | ''>('');
  const [price, setPrice] = useState('');
  const [tradeFor, setTradeFor] = useState('');
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [showCustomBrand, setShowCustomBrand] = useState(false);
  const [size, setSize] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [showCustomSize, setShowCustomSize] = useState(false);

  const showPrice = listingType === 'sell' || listingType === 'both';
  const showTrade = listingType === 'trade' || listingType === 'both';

  const canContinue = listingType !== '' && (!showPrice || price.trim() !== '');

  return (
    <KeyboardAwareScreen className="bg-base-canvas">
      <BrandBackground />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
          <View className="flex-1" />
          <Text className="font-sans text-xs text-ink-dark/40">3 / 4</Text>
        </View>

        {/* Progress bar */}
        <View className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-ink-dark/8">
          <View className="h-full w-3/4 rounded-full bg-brand-accent-deep" />
        </View>

        <View className="px-5 pt-8">
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            {t('upload.listingEyebrow')}
          </Text>
          <Text className="mt-1 font-display text-4xl text-ink-dark">
            {t('upload.listingTitle')}
          </Text>

          {/* Listing type cards */}
          <View className="mt-6 gap-3">
            {LISTING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setListingType(opt.value)}
                className={`flex-row items-center rounded-[22px] px-5 py-5 ${
                  listingType === opt.value
                    ? 'bg-brand-accent-deep'
                    : 'border border-ink-dark/8 bg-surface-panel'
                }`}
              >
                <View
                  className={`mr-4 h-12 w-12 items-center justify-center rounded-2xl ${
                    listingType === opt.value ? 'bg-base-canvas/20' : 'bg-brand-accent-light/25'
                  }`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={listingType === opt.value ? colors.baseCanvas : colors.accentDeep}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-sans text-base font-semibold ${
                      listingType === opt.value ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {opt.value === 'trade'
                      ? t('upload.listingTrade')
                      : opt.value === 'sell'
                        ? t('upload.listingSell')
                        : t('upload.listingBoth')}
                  </Text>
                  <Text
                    className={`mt-0.5 font-sans text-xs ${
                      listingType === opt.value ? 'text-base-canvas/70' : 'text-ink-dark/50'
                    }`}
                  >
                    {opt.value === 'trade'
                      ? t('upload.listingTradeDesc')
                      : opt.value === 'sell'
                        ? t('upload.listingSellDesc')
                        : t('upload.listingBothDesc')}
                  </Text>
                </View>
                {listingType === opt.value ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.baseCanvas} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {/* Price field */}
          {showPrice ? (
            <View className="mt-6">
              <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">
                {t('upload.priceLabel')}
              </Text>
              <View className="flex-row items-center rounded-[20px] border border-ink-dark/8 bg-surface-panel px-5">
                <Ionicons name="logo-euro" size={18} color={colors.mutedText} />
                <VelveTextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  keyboardType="numeric"
                  className="ml-2 flex-1 py-4 font-sans text-2xl font-semibold text-ink-dark"
                />
              </View>
            </View>
          ) : null}

          {/* Trade for field */}
          {showTrade ? (
            <View className="mt-6">
              <Text className="mb-2 font-sans text-sm font-semibold text-ink-dark">
                {t('upload.tradeForLabel')}
              </Text>
              <VelveTextInput
                value={tradeFor}
                onChangeText={setTradeFor}
                placeholder={t('upload.tradeForPlaceholder')}
                className="rounded-[20px] border border-ink-dark/8 bg-surface-panel px-5 py-4 font-sans text-sm text-ink-dark"
              />
            </View>
          ) : null}

          {/* Brand */}
          <View className="mt-8">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              {t('upload.detailsEyebrow')}
            </Text>
            <Text className="mt-3 font-sans text-sm font-semibold text-ink-dark">
              {t('upload.brandLabel')}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ paddingRight: 20, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => {
                setBrand('');
                setShowCustomBrand(false);
                setCustomBrand('');
              }}
              className={`rounded-full px-4 py-2.5 ${
                brand === '' && !showCustomBrand
                  ? 'bg-brand-accent-deep'
                  : 'border border-ink-dark/10 bg-surface-panel'
              }`}
            >
              <Text
                className={`font-sans text-sm ${
                  brand === '' && !showCustomBrand
                    ? 'font-semibold text-base-canvas'
                    : 'text-ink-dark/60'
                }`}
              >
                {t('upload.brandUnknown')}
              </Text>
            </TouchableOpacity>
            {POPULAR_BRANDS.map((b) => (
              <TouchableOpacity
                key={b}
                onPress={() => {
                  setBrand(b);
                  setShowCustomBrand(false);
                  setCustomBrand('');
                }}
                className={`rounded-full px-4 py-2.5 ${
                  brand === b
                    ? 'bg-brand-accent-deep'
                    : 'border border-ink-dark/10 bg-surface-panel'
                }`}
              >
                <Text
                  className={`font-sans text-sm ${
                    brand === b ? 'font-semibold text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowCustomBrand(true);
                setBrand('');
              }}
              className={`flex-row items-center rounded-full px-4 py-2.5 ${
                showCustomBrand
                  ? 'bg-brand-accent-deep'
                  : 'border border-ink-dark/10 bg-surface-panel'
              }`}
            >
              <Ionicons
                name="add"
                size={16}
                color={showCustomBrand ? colors.baseCanvas : colors.inkDark}
              />
              <Text
                className={`ml-1 font-sans text-sm ${
                  showCustomBrand ? 'font-semibold text-base-canvas' : 'text-ink-dark'
                }`}
              >
                {t('upload.brandOther')}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showCustomBrand ? (
            <VelveTextInput
              value={customBrand}
              onChangeText={(text) => {
                setCustomBrand(text);
                setBrand(text);
              }}
              placeholder={t('upload.brandPlaceholder')}
              autoFocus
              className="mt-3 rounded-[20px] border border-brand-accent-deep/20 bg-surface-panel px-5 py-4 font-sans text-sm text-ink-dark"
            />
          ) : null}

          {/* Size */}
          <View className="mt-6">
            <Text className="font-sans text-sm font-semibold text-ink-dark">
              {t('upload.sizeLabel')}
            </Text>
          </View>

          <View className="mt-3 flex-row flex-wrap gap-2">
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  setSize(s);
                  setShowCustomSize(false);
                  setCustomSize('');
                }}
                className={`min-w-[52px] items-center rounded-full px-4 py-2.5 ${
                  size === s ? 'bg-brand-accent-deep' : 'border border-ink-dark/10 bg-surface-panel'
                }`}
              >
                <Text
                  className={`font-sans text-sm ${
                    size === s ? 'font-semibold text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowCustomSize(true);
                setSize('');
              }}
              className={`flex-row items-center rounded-full px-4 py-2.5 ${
                showCustomSize
                  ? 'bg-brand-accent-deep'
                  : 'border border-ink-dark/10 bg-surface-panel'
              }`}
            >
              <Ionicons
                name="add"
                size={16}
                color={showCustomSize ? colors.baseCanvas : colors.inkDark}
              />
              <Text
                className={`ml-1 font-sans text-sm ${
                  showCustomSize ? 'font-semibold text-base-canvas' : 'text-ink-dark'
                }`}
              >
                {t('upload.sizeOther')}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomSize ? (
            <VelveTextInput
              value={customSize}
              onChangeText={(text) => {
                setCustomSize(text);
                setSize(text);
              }}
              placeholder={t('upload.sizePlaceholder')}
              autoFocus
              className="mt-3 rounded-[20px] border border-brand-accent-deep/20 bg-surface-panel px-5 py-4 font-sans text-sm text-ink-dark"
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-base-canvas px-5 pt-3"
        style={{
          paddingBottom: insets.bottom + 12,
          shadowColor: '#2B2A2B',
          shadowOpacity: 0.07,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
          elevation: 6,
        }}
      >
        <TouchableOpacity
          disabled={!canContinue}
          onPress={() =>
            router.push({
              pathname: '/upload-flow/description',
              params: {
                itemId,
                category,
                condition,
                listingType,
                price: showPrice ? price : '',
                tradeFor: showTrade ? tradeFor : '',
                brand,
                size,
              },
            })
          }
          className={`items-center rounded-full bg-brand-accent-deep px-4 py-4 ${
            canContinue ? '' : 'opacity-40'
          }`}
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            {t('upload.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  );
}
