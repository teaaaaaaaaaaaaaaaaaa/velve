import { NativeModules, TurboModuleRegistry } from 'react-native';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStorage = new Map<string, string>();

let cachedStorage: StorageLike | null = null;
let warnedAboutFallback = false;

const asyncStorageModuleNames = [
  'PlatformLocalStorage',
  'RNC_AsyncSQLiteDBStorage',
  'RNCAsyncStorage',
  'AsyncSQLiteDBStorage',
  'AsyncLocalStorage',
] as const;

function createFallbackStorage(): StorageLike {
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      '[Storage] AsyncStorage native module is unavailable. Falling back to in-memory storage until the Android app is rebuilt.'
    );
  }

  return {
    async getItem(key) {
      return memoryStorage.has(key) ? (memoryStorage.get(key) ?? null) : null;
    },
    async setItem(key, value) {
      memoryStorage.set(key, value);
    },
    async removeItem(key) {
      memoryStorage.delete(key);
    },
  };
}

function hasNativeAsyncStorageModule() {
  return asyncStorageModuleNames.some((moduleName) => {
    const turboModule = TurboModuleRegistry?.get?.(moduleName);
    const nativeModule = NativeModules?.[moduleName];
    return Boolean(turboModule ?? nativeModule);
  });
}

function resolveStorage(): StorageLike {
  if (cachedStorage) {
    return cachedStorage;
  }

  if (!hasNativeAsyncStorageModule()) {
    cachedStorage = createFallbackStorage();
    return cachedStorage;
  }

  try {
    const asyncStorageModule = require('@react-native-async-storage/async-storage');
    const asyncStorage = asyncStorageModule?.default ?? asyncStorageModule;

    if (
      asyncStorage &&
      typeof asyncStorage.getItem === 'function' &&
      typeof asyncStorage.setItem === 'function' &&
      typeof asyncStorage.removeItem === 'function'
    ) {
      cachedStorage = asyncStorage as StorageLike;
      return cachedStorage;
    }
  } catch (error) {
    console.warn(
      '[Storage] Failed to initialize AsyncStorage package, using fallback storage',
      error
    );
  }

  cachedStorage = createFallbackStorage();
  return cachedStorage;
}

export function getStorage() {
  return resolveStorage();
}
