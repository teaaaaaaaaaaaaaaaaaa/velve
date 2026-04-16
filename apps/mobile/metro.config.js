const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// 1. Dobavi Expo default config
let config = getDefaultConfig(projectRoot);

// 2. Primeni monorepo konfiguraciju
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.blockList = [
  /apps[\\/]ai-server[\\/]\.venv[\\/].*/,
  /apps[\\/]ai-server[\\/]__pycache__[\\/].*/,
];

// 3. Firebase compatibility
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'cjs'];
config.resolver.unstable_enablePackageExports = false;


// 5. Na kraju wrappuj sa NativeWind
module.exports = withNativeWind(config, { input: './global.css' });
