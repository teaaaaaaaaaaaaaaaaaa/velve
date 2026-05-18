import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import {
  previewChats,
  previewItems,
  previewMessages,
  previewOutfits,
  previewTrades,
  previewUser,
  previewUsers,
} from '@/design/previewData';

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return {
    data,
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    headers: {},
    config,
  };
}

function ok(
  config: InternalAxiosRequestConfig,
  data: unknown,
  extra: Record<string, unknown> = {}
) {
  return response(config, { ok: true, data, ...extra });
}

function notFound(config: InternalAxiosRequestConfig) {
  return response(config, { ok: false, error: 'PREVIEW_NOT_FOUND' }, 404);
}

function getPath(config: InternalAxiosRequestConfig) {
  const url = new URL(config.url ?? '/', 'https://preview.velve.local');
  return url.pathname.replace(/\/+$/, '') || '/';
}

function getItemById(id?: string) {
  return previewItems.find((item) => item._id === id) ?? previewItems[0];
}

function getUserById(id?: string) {
  return previewUsers.find((user) => user._id === id) ?? previewUsers[1];
}

function getClosetPayload() {
  return {
    live: previewItems.filter((item) => item.status === 'available'),
    drafts: previewItems.filter((item) => item.status === 'draft'),
    archive: previewItems.filter((item) => item.status === 'archived'),
  };
}

export const designPreviewAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const path = getPath(config);

  if (method !== 'get') {
    if (path === '/api/upload') {
      return ok(config, {
        url: previewItems[0].primaryImage,
        imageUrl: previewItems[0].primaryImage,
      });
    }

    if (path === '/api/items') {
      return ok(config, { ...previewItems[0], _id: 'preview-draft-item' });
    }

    if (path.includes('/message')) {
      return ok(config, {
        _id: `preview-message-${Date.now()}`,
        text: config.data?.text || 'Preview message',
        senderId: previewUser,
        createdAt: new Date().toISOString(),
        status: 'sent',
      });
    }

    return ok(config, { preview: true });
  }

  if (path === '/api/users/me') return ok(config, previewUser);
  if (path === '/api/users/body-scan') {
    return ok(config, { exists: true, url: previewUser.bodyScanUrl });
  }
  if (path === '/api/users/me/blocked-users') return ok(config, []);
  if (path === '/api/users/me/notification-preferences') {
    return ok(config, { messages: true, trades: true, wishlist: true, product: true });
  }

  if (path.startsWith('/api/users/') && path.endsWith('/followers')) {
    return ok(config, previewUsers.slice(1));
  }
  if (path.startsWith('/api/users/') && path.endsWith('/following')) {
    return ok(config, previewUsers.slice(1));
  }
  if (path.startsWith('/api/users/')) {
    return ok(config, getUserById(path.split('/')[3]));
  }

  if (path === '/api/feed') {
    return ok(config, previewItems, { hasMore: false, nextCursor: null });
  }
  if (path === '/api/items') {
    return ok(config, previewItems, { hasMore: false, nextCursor: null });
  }
  if (path === '/api/items/closet') return ok(config, getClosetPayload());
  if (path.match(/^\/api\/items\/[^/]+\/similar$/)) {
    return ok(config, previewItems.slice(1), { hasMore: false, nextCursor: null });
  }
  if (path.match(/^\/api\/items\/[^/]+\/images$/)) {
    const item = getItemById(path.split('/')[3]);
    return ok(config, {
      imageOriginal: item.primaryImage ?? item.images?.[0] ?? null,
      imageClean: item.imageClean ?? item.primaryImage ?? null,
      isDigitized: Boolean(item.isDigitized || item.imageClean),
    });
  }
  if (path.startsWith('/api/items/')) {
    const item = getItemById(path.split('/')[3]);
    return item ? ok(config, item) : notFound(config);
  }

  if (path === '/api/wishlist') return ok(config, previewItems.slice(0, 2));
  if (path === '/api/chat') return ok(config, previewChats);
  if (path.startsWith('/api/chat/')) {
    return ok(config, {
      room: previewChats[0],
      messages: previewMessages,
      tradeRequest: previewTrades[0],
    });
  }
  if (path === '/api/trades') return ok(config, previewTrades);
  if (path === '/api/trades/history') return ok(config, previewTrades);
  if (path === '/api/notifications') {
    return ok(config, [
      {
        _id: 'preview-notification-1',
        type: 'trade',
        title: 'New trade proposal',
        body: 'Nora Studio offered a velvet blazer.',
        read: false,
        createdAt: '2026-05-18T12:30:00.000Z',
      },
    ]);
  }
  if (path === '/api/notifications/unread-count') return ok(config, { unreadCount: 1 });
  if (path === '/api/vto/outfits') return ok(config, previewOutfits);

  return notFound(config);
};
