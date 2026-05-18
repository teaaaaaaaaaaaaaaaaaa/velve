import type { TranslationKey } from '@/i18n';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

type AuthFlow = 'login' | 'register';

export type InlineAuthFeedback = {
  message: string;
  recovery?: string;
};

const EXPECTED_AUTH_ERROR_CODES = new Set([
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/invalid-email',
  'auth/user-disabled',
  'auth/too-many-requests',
  'auth/network-request-failed',
  'auth/email-already-in-use',
  'auth/weak-password',
  'auth/operation-not-allowed',
]);

function getErrorCode(error: unknown) {
  const value = error as { code?: string; nativeErrorCode?: string };
  return value?.code || value?.nativeErrorCode || '';
}

function isNetworkError(error: unknown) {
  const value = error as { message?: string };
  return (
    getErrorCode(error) === 'auth/network-request-failed' ||
    value?.message?.toLowerCase().includes('network') === true
  );
}

export function isExpectedAuthError(error: unknown) {
  return EXPECTED_AUTH_ERROR_CODES.has(getErrorCode(error)) || isNetworkError(error);
}

export function getAuthInlineFeedback(
  error: unknown,
  t: Translate,
  flow: AuthFlow,
  retryAfterSeconds?: number
): InlineAuthFeedback {
  const code = getErrorCode(error);

  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return {
      message: t('auth.error.invalidCredentials'),
      recovery: t('auth.error.invalidCredentialsRecovery'),
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      message: t('auth.error.invalidEmail'),
      recovery: t('auth.error.invalidEmailRecovery'),
    };
  }

  if (code === 'auth/user-disabled') {
    return {
      message: t('auth.error.userDisabled'),
      recovery: t('auth.error.userDisabledRecovery'),
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      message: t('auth.error.tooManyRequests'),
      recovery: retryAfterSeconds
        ? t('auth.error.tooManyRequestsRecoveryTimed', { seconds: retryAfterSeconds })
        : t('auth.error.tooManyRequestsRecovery'),
    };
  }

  if (isNetworkError(error)) {
    return {
      message: t('auth.error.network'),
      recovery: t('auth.error.networkRecovery'),
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      message: t('auth.error.emailInUse'),
      recovery: t('auth.error.emailInUseRecovery'),
    };
  }

  if (code === 'auth/weak-password') {
    return {
      message: t('auth.error.weakPassword'),
      recovery: t('auth.error.weakPasswordRecovery'),
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      message: t('auth.error.operationNotAllowed'),
      recovery: t('auth.error.operationNotAllowedRecovery'),
    };
  }

  return flow === 'register'
    ? {
        message: t('auth.error.registerGeneric'),
        recovery: t('auth.error.registerGenericRecovery'),
      }
    : {
        message: t('auth.error.loginGeneric'),
        recovery: t('auth.error.loginGenericRecovery'),
      };
}

export function getAuthValidationFeedback(
  kind: 'empty' | 'invalidEmail' | 'shortPassword',
  t: Translate
): InlineAuthFeedback {
  if (kind === 'empty') {
    return {
      message: t('auth.error.emptyFields'),
      recovery: t('auth.error.emptyFieldsRecovery'),
    };
  }

  if (kind === 'shortPassword') {
    return {
      message: t('auth.error.shortPassword'),
      recovery: t('auth.error.shortPasswordRecovery'),
    };
  }

  return {
    message: t('auth.error.invalidEmail'),
    recovery: t('auth.error.invalidEmailRecovery'),
  };
}

export function getGoogleSignInFeedback(
  error: unknown,
  t: Translate,
  unavailableReason?: string | null
) {
  const value = error as { message?: string };

  if (value?.message === 'GOOGLE_SIGNIN_UNAVAILABLE') {
    return {
      title: t('auth.googleErrorTitle'),
      message: unavailableReason || t('auth.googleErrorUnavailable'),
    };
  }

  if (value?.message?.includes('CLIENT_ID')) {
    return {
      title: t('auth.googleErrorTitle'),
      message: t('auth.googleErrorConfig'),
    };
  }

  if (value?.message === 'NETWORK_ERROR') {
    return {
      title: t('auth.googleErrorTitle'),
      message: t('auth.googleErrorNetwork'),
    };
  }

  if (value?.message === 'OAUTH_FAILED') {
    return {
      title: t('auth.googleErrorTitle'),
      message: t('auth.googleErrorOauth'),
    };
  }

  return {
    title: t('auth.googleErrorTitle'),
    message: t('auth.googleErrorGeneric'),
  };
}

export function getProfileResolutionCopy(profileError: string | null, t: Translate) {
  if (profileError === 'USER_MISMATCH') {
    return {
      title: t('auth.sessionMismatchTitle'),
      message: t('auth.sessionMismatchDescription'),
      recovery: t('auth.sessionMismatchRecovery'),
    };
  }

  if (profileError === 'INVALID_PROFILE_RESPONSE') {
    return {
      title: t('auth.sessionProfileTitle'),
      message: t('auth.sessionProfileDescription'),
      recovery: t('auth.sessionProfileRecovery'),
    };
  }

  return {
    title: t('auth.sessionTitle'),
    message: t('auth.sessionDescription'),
    recovery: t('auth.sessionRecovery'),
  };
}
