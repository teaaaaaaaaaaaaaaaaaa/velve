import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandBackground } from '@/components/BrandBackground';
import { BrandWordmark } from '@/components/BrandWordmark';
import { GlassSurface } from '@/components/GlassSurface';
import { isDesignPreviewMode } from '@/config/designPreview';
import { colors } from '@/design/tokens';

type PreviewRoute = {
  label: string;
  route: Parameters<ReturnType<typeof useRouter>['push']>[0];
  note: string;
};

const groups: { title: string; routes: PreviewRoute[] }[] = [
  {
    title: 'Auth',
    routes: [
      { label: 'Login', route: '/(auth)/login', note: 'Google-first entry' },
      { label: 'Register', route: '/(auth)/register', note: 'Email secondary path' },
    ],
  },
  {
    title: 'Onboarding',
    routes: [
      { label: 'Terms', route: '/onboarding/terms', note: 'Required legal gate' },
      { label: 'Welcome', route: '/onboarding/welcome', note: 'Brand arrival' },
      { label: 'Style', route: '/onboarding/style', note: 'Taste selection' },
      { label: 'Categories', route: '/onboarding/categories', note: 'Wardrobe interests' },
      { label: 'Brands', route: '/onboarding/brands', note: 'Favorite labels' },
      { label: 'About', route: '/onboarding/about', note: 'Size and city' },
      { label: 'Photo', route: '/onboarding/photo', note: 'Optional profile image' },
      { label: 'Scan', route: '/onboarding/scan', note: 'Optional VTO setup' },
    ],
  },
  {
    title: 'Main Tabs',
    routes: [
      { label: 'Feed', route: '/(tabs)/feed', note: 'Immersive discovery' },
      { label: 'Chat', route: '/(tabs)/chat', note: 'Messages and trades' },
      { label: 'Profile', route: '/(tabs)/profile', note: 'Own style profile' },
      { label: 'Closet', route: '/(tabs)/closet', note: 'Hidden tab route' },
      { label: 'Wishlist', route: '/(tabs)/wishlist', note: 'Saved items' },
    ],
  },
  {
    title: 'Item And User',
    routes: [
      { label: 'Item Detail', route: '/items/preview-item-1', note: 'Primary item story' },
      { label: 'Public Profile', route: '/users/preview-user-2', note: 'Other user wardrobe' },
      { label: 'Search', route: '/search', note: 'Discovery results' },
      { label: 'Connections', route: '/connections', note: 'Followers/following shell' },
      { label: 'Notifications', route: '/notifications', note: 'Activity center' },
      { label: 'Settings', route: '/settings', note: 'Account controls' },
    ],
  },
  {
    title: 'Upload Flow',
    routes: [
      { label: 'Start', route: '/upload-flow', note: 'Clean Cut entry' },
      { label: 'Preview', route: '/upload-flow/preview', note: 'Selected image' },
      { label: 'Analyze', route: '/upload-flow/analyze', note: 'Quality checks' },
      { label: 'Transform', route: '/upload-flow/transform', note: 'AI progress' },
      {
        label: 'Review',
        route: { pathname: '/upload-flow/review', params: { itemId: 'preview-item-1' } },
        note: 'Original vs Clean Cut',
      },
      { label: 'Category', route: '/upload-flow/category', note: 'Category and condition' },
      { label: 'Listing', route: '/upload-flow/listing', note: 'Trade/sell details' },
      { label: 'Description', route: '/upload-flow/description', note: 'AI copy assist' },
    ],
  },
  {
    title: 'Virtual Try-On',
    routes: [
      { label: 'Hub', route: '/vto/hub', note: 'Current render' },
      { label: 'Select', route: '/vto/select', note: 'Choose digitized item' },
      {
        label: 'Render',
        route: { pathname: '/vto/render', params: { itemIds: 'preview-item-1' } },
        note: 'Generated outfit',
      },
      { label: 'Body Scan', route: '/vto/body-scan', note: 'Intro' },
      { label: 'Body Scan Camera', route: '/vto/body-scan-camera', note: 'Camera UI shell' },
      { label: 'Body Scan Ready', route: '/vto/body-scan-ready', note: 'Completion state' },
      { label: 'Archive', route: '/vto/archive', note: 'Digitized archive' },
    ],
  },
];

export default function DesignPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!isDesignPreviewMode) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas px-6">
        <Text className="text-center font-display text-3xl text-ink-dark">
          Design preview is disabled.
        </Text>
        <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/60">
          Start the mobile app with EXPO_PUBLIC_DESIGN_PREVIEW=1.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 22,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 36,
        }}
      >
        <View className="items-center">
          <BrandWordmark width={170} />
          <Text className="mt-5 text-center font-display text-4xl text-ink-dark">
            Mobile design preview
          </Text>
          <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/60">
            iPhone is the visual source of truth. This web gallery is only a helper for Claude/Figma
            capture.
          </Text>
        </View>

        <GlassSurface className="mt-7 px-5 py-5">
          <Text className="font-sans text-xs font-bold uppercase text-ink-dark/45">
            Capture record
          </Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/70">
            Save route name, platform, viewport/device, and whether the frame matches the iPhone
            gold screenshot or needs review.
          </Text>
        </GlassSurface>

        {groups.map((group) => (
          <View key={group.title} className="mt-7">
            <Text className="mb-3 font-display text-2xl text-ink-dark">{group.title}</Text>
            <View className="overflow-hidden rounded-[28px] border border-ink-dark/6 bg-surface-panel">
              {group.routes.map((entry, index) => (
                <TouchableOpacity
                  key={entry.label}
                  activeOpacity={0.86}
                  onPress={() => router.push(entry.route)}
                  className={`flex-row items-center px-4 py-4 ${
                    index > 0 ? 'border-t border-ink-dark/6' : ''
                  }`}
                >
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-accent-light/25">
                    <Ionicons name="phone-portrait-outline" size={18} color={colors.accentDeep} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans text-base font-semibold text-ink-dark">
                      {entry.label}
                    </Text>
                    <Text className="mt-0.5 font-sans text-xs text-ink-dark/50">{entry.note}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
