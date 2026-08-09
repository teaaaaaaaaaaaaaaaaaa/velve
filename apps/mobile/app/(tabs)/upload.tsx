import { View } from 'react-native';

// Placeholder route. The upload tab tap is intercepted in (tabs)/_layout.tsx
// (listeners.tabPress -> router.push('/upload-flow')) so this screen never
// actually renders. The file exists only because expo-router needs a file to
// register the "upload" Tabs.Screen entry.
export default function UploadTabPlaceholder() {
  return <View />;
}
