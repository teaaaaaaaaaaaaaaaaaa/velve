import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'

const DEFAULT_PORT = '3000'
const LOCALHOST_ALIASES = new Set(['localhost', '127.0.0.1', '::1'])

function extractHost(input?: string | null) {
  if (!input) return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const withProtocol = trimmed.includes('://') ? trimmed : `http://${trimmed}`

  try {
    return new URL(withProtocol).hostname
  } catch {
    const match = trimmed.match(/^(?:exp|exps|http|https):\/\/([^/:]+)/i)
    return match?.[1] ?? null
  }
}

function getDevServerHost() {
  const sourceCodeHost = extractHost(NativeModules.SourceCode?.scriptURL)
  if (sourceCodeHost) return sourceCodeHost

  const constants = Constants as typeof Constants & {
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } }
    expoGoConfig?: { hostUri?: string }
  }

  const candidates = [
    Constants.expoConfig?.hostUri,
    constants.expoGoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.linkingUri,
  ]

  for (const candidate of candidates) {
    const host = extractHost(candidate)
    if (host) return host
  }

  return null
}

function normalizeConfiguredUrl(input?: string) {
  if (!input?.trim()) return null

  try {
    const url = new URL(input)
    return url.origin
  } catch {
    return null
  }
}

export function getApiBaseUrl() {
  const configuredUrl = normalizeConfiguredUrl(process.env.EXPO_PUBLIC_API_URL)

  if (!__DEV__) {
    return configuredUrl ?? `http://localhost:${DEFAULT_PORT}`
  }

  const devServerHost = getDevServerHost()

  if (devServerHost && !LOCALHOST_ALIASES.has(devServerHost)) {
    return `http://${devServerHost}:${DEFAULT_PORT}`
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`
  }

  return configuredUrl ?? `http://localhost:${DEFAULT_PORT}`
}

export const API_URL = getApiBaseUrl()
