import { Platform } from 'react-native';

import client from '@/api/client';
import { getStorage } from '@/lib/storage';

const GUEST_SESSION_KEY = 'velve.guest.sessionId';

export type GuestEventType =
  | 'guest_feed_view'
  | 'guest_item_impression'
  | 'guest_item_open_attempt'
  | 'guest_like_attempt'
  | 'guest_wishlist_attempt'
  | 'guest_trade_attempt'
  | 'guest_search_attempt'
  | 'guest_nav_attempt'
  | 'guest_signup_wall_view'
  | 'guest_signup_cta_click';

function createSessionId() {
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getGuestSessionId() {
  const storage = getStorage();
  const existing = await storage.getItem(GUEST_SESSION_KEY);
  if (existing) return existing;

  const next = createSessionId();
  await storage.setItem(GUEST_SESSION_KEY, next);
  return next;
}

export async function trackGuestEvent(
  eventType: GuestEventType,
  options: {
    itemId?: string;
    route?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    const sessionId = await getGuestSessionId();
    await client.post('/api/feed/guest/events', {
      eventType,
      sessionId,
      itemId: options.itemId,
      route: options.route ?? '/(tabs)/feed',
      platform: Platform.OS,
      metadata: options.metadata ?? {},
    });
  } catch (unknownError: unknown) {
    const error = unknownError as { message?: string };
    if (__DEV__) {
      console.warn('[GuestAnalytics] event skipped', {
        eventType,
        message: error?.message,
      });
    }
  }
}
