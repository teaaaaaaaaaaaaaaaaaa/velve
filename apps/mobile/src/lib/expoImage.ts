import { requireOptionalNativeModule } from 'expo';
import { Platform, UIManager } from 'react-native';

type ExpoImageModule = typeof import('expo-image');

let cachedModule: ExpoImageModule | null | undefined;
let cachedAvailability: boolean | undefined;
let hasLoggedFallbackWarning = false;

function hasExpoImageViewManager() {
  if (Platform.OS === 'web') {
    return true;
  }

  if (typeof UIManager.getViewManagerConfig === 'function') {
    return !!UIManager.getViewManagerConfig('ExpoImage');
  }

  return 'ExpoImage' in UIManager;
}

function canUseExpoImage() {
  if (cachedAvailability !== undefined) {
    return cachedAvailability;
  }

  if (Platform.OS === 'web') {
    cachedAvailability = true;
    return cachedAvailability;
  }

  cachedAvailability = !!requireOptionalNativeModule('ExpoImage') && hasExpoImageViewManager();

  return cachedAvailability;
}

function logFallbackWarning() {
  if (!__DEV__ || hasLoggedFallbackWarning) {
    return;
  }

  hasLoggedFallbackWarning = true;
  console.warn(
    '[RemoteImage] expo-image native module is unavailable in this build. Falling back to react-native Image. Rebuild the development client to restore expo-image caching and transitions.'
  );
}

export function getExpoImageComponent() {
  if (cachedModule !== undefined) {
    return cachedModule?.Image ?? null;
  }

  if (!canUseExpoImage()) {
    cachedModule = null;
    logFallbackWarning();
    return null;
  }

  try {
    cachedModule = require('expo-image') as ExpoImageModule;
  } catch {
    cachedModule = null;
    logFallbackWarning();
  }

  return cachedModule?.Image ?? null;
}

export async function prefetchImageUri(uri: string) {
  const ExpoImage = getExpoImageComponent();

  if (!ExpoImage) {
    return false;
  }

  try {
    return await ExpoImage.prefetch(uri);
  } catch {
    return false;
  }
}
