import axios, { type InternalAxiosRequestConfig } from 'axios';

import { designPreviewAdapter } from '@/api/designPreviewAdapter';
import { API_URL } from '@/config/api';
import { isDesignPreviewMode } from '@/config/designPreview';
import { auth, getAuthToken } from '@/config/firebase';
import { logger } from '@/lib/logger';

const debugLog = logger.debug;

debugLog('[APIClient] Using baseURL:', API_URL);

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retryWithFreshAuth?: boolean;
};

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  adapter: isDesignPreviewMode ? designPreviewAdapter : undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: dodaje Firebase ID token u svaki zahtev
client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await getAuthToken(user);
    config.headers.Authorization = `Bearer ${token}`;
    debugLog(
      '[APIClient] Request:',
      config.method?.toUpperCase(),
      `${config.baseURL ?? ''}${config.url ?? ''}`,
      {
        auth: 'with auth',
        uid: user.uid,
      }
    );
  } else {
    debugLog(
      '[APIClient] Request:',
      config.method?.toUpperCase(),
      `${config.baseURL ?? ''}${config.url ?? ''}`,
      {
        auth: 'no auth',
      }
    );
  }
  return config;
});

// Response interceptor: loguje odgovore i greske.
// Ekrani prikazuju network/API greske inline uz Retry gde god korisnik moze da nastavi tok.
client.interceptors.response.use(
  (response) => {
    debugLog('[APIClient] Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const url = error.config?.url || '';
    const baseURL = error.config?.baseURL || '';
    const status = error.response?.status;
    const originalConfig = error.config as RetriableRequestConfig | undefined;

    debugLog('[APIClient] Error:', status, `${baseURL}${url}`, {
      message: error.message,
      response: error.response?.data,
      currentUserUid: auth.currentUser?.uid ?? null,
    });

    // Auth expired
    if (status === 401) {
      debugLog('[APIClient] Auth token expired or invalid', {
        currentUserUid: auth.currentUser?.uid ?? null,
      });

      const user = auth.currentUser;
      if (!user) {
        debugLog('[APIClient] Ignoring 401 refresh because there is no signed-in user');
      }
      if (user && originalConfig && !originalConfig._retryWithFreshAuth) {
        originalConfig._retryWithFreshAuth = true;

        try {
          const freshToken = await getAuthToken(user, true);
          originalConfig.headers.Authorization = `Bearer ${freshToken}`;
          debugLog('[APIClient] Retrying request with refreshed auth token', {
            method: originalConfig.method?.toUpperCase(),
            url: `${baseURL}${url}`,
            uid: user.uid,
          });
          return client(originalConfig);
        } catch (unknownRefreshError: unknown) {
          const refreshError = unknownRefreshError as { message?: string };
          debugLog('[APIClient] Failed to refresh auth token after 401', {
            message: refreshError?.message,
            currentUserUid: auth.currentUser?.uid ?? null,
          });
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
