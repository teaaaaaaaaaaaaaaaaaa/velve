import { ImageURISource } from 'react-native';

import { API_URL } from '@/config/api';

const REMOTE_IMAGE_HEADERS = {
  Accept: 'image/avif,image/webp,image/*,*/*',
  'User-Agent': 'VelveMobile/1.0',
} as const;

const REMOTE_URI_REGEX = /^https?:\/\//i;
const LOCAL_URI_REGEX = /^(?:file|content|asset|data):/i;

function toAbsoluteUri(input: string) {
  if (input.startsWith('//')) {
    return `https:${input}`;
  }

  if (input.startsWith('/')) {
    return new URL(input, API_URL).toString();
  }

  return input;
}

export function normalizeImageUri(input?: string | null) {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const absoluteUri = toAbsoluteUri(trimmed);

  if (LOCAL_URI_REGEX.test(absoluteUri)) {
    return absoluteUri;
  }

  if (REMOTE_URI_REGEX.test(absoluteUri)) {
    try {
      return new URL(absoluteUri).toString();
    } catch {
      return encodeURI(absoluteUri);
    }
  }

  return null;
}

export function getRemoteImageSource(uri?: string | null): ImageURISource | null {
  const normalizedUri = normalizeImageUri(uri);

  if (!normalizedUri) {
    return null;
  }

  if (LOCAL_URI_REGEX.test(normalizedUri)) {
    return { uri: normalizedUri };
  }

  return {
    uri: normalizedUri,
    cache: 'force-cache',
    headers: REMOTE_IMAGE_HEADERS,
  };
}
