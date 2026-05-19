import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandBackground } from '@/components/BrandBackground';
import { BrandWordmark } from '@/components/BrandWordmark';
import { GlassSurface } from '@/components/GlassSurface';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { VelveTextInput, type VelveTextInputRef } from '@/components/VelveTextInput';
import { colors } from '@/design/tokens';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import {
  getAuthInlineFeedback,
  getAuthValidationFeedback,
  getGoogleSignInFeedback,
  isExpectedAuthError,
  type InlineAuthFeedback,
} from '@/lib/authFeedback';
import { Alert } from '@/lib/velveAlert';

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.trim().split('@');
  if (!domain) return `${localPart.slice(0, 2)}***`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const {
    signInWithGoogle,
    signInWithEmail,
    googleSignInAvailable,
    googleSignInUnavailableReason,
  } = useAuth();
  const { t } = useI18n();

  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<InlineAuthFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const passwordRef = useRef<VelveTextInputRef>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!blockedUntil) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) {
        setBlockedUntil(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  async function handleEmailLogin() {
    setFeedback(null);
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      console.warn('[LoginScreen] Email login blocked because fields are empty');
      setFeedback(getAuthValidationFeedback('empty', t));
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setFeedback(getAuthValidationFeedback('invalidEmail', t));
      return;
    }

    if (blockedUntil && blockedUntil > Date.now()) {
      setFeedback(
        getAuthInlineFeedback({ code: 'auth/too-many-requests' }, t, 'login', remainingSeconds)
      );
      return;
    }

    console.log('[LoginScreen] Email login pressed', {
      email: maskEmail(normalizedEmail),
      passwordLength: password.length,
    });
    setLoading(true);
    try {
      await signInWithEmail(normalizedEmail, password);
      setBlockedUntil(null);
      console.log('[LoginScreen] Email login request resolved successfully');
    } catch (e: any) {
      const logger = isExpectedAuthError(e) ? console.warn : console.error;
      logger('[LoginScreen] Email login failed', {
        code: e?.code,
        message: e?.message,
        nativeErrorCode: e?.nativeErrorCode,
      });

      const nextBlockedUntil =
        e?.code === 'auth/too-many-requests' ? Date.now() + 60000 : blockedUntil;
      if (nextBlockedUntil) {
        setBlockedUntil(nextBlockedUntil);
      }

      const retryAfterSeconds = nextBlockedUntil
        ? Math.max(1, Math.ceil((nextBlockedUntil - Date.now()) / 1000))
        : undefined;
      setFeedback(getAuthInlineFeedback(e, t, 'login', retryAfterSeconds));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      console.log('[LoginScreen] Google login pressed');
      await signInWithGoogle();
      console.log('[LoginScreen] Google login request resolved successfully');
    } catch (e: any) {
      const logger = e?.message === 'USER_CANCELLED' ? console.warn : console.error;
      logger('[LoginScreen] Google login failed', {
        code: e?.code,
        message: e?.message,
      });
      if (e.message === 'USER_CANCELLED') {
        return;
      }

      const { title, message } = getGoogleSignInFeedback(e, t, googleSignInUnavailableReason);
      Alert.alert(title, message);
    }
  }

  return (
    <KeyboardAwareScreen className="bg-base-canvas" offset={10}>
      <BrandBackground />

      <TouchableOpacity
        className="absolute left-5 z-10 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        style={{ top: insets.top + 10 }}
        activeOpacity={0.86}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/(tabs)/feed');
        }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.inkDark} />
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 24, 48),
          paddingBottom: Math.max(insets.bottom + 28, 36),
          minHeight: height,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center" style={{ marginBottom: showEmailLogin ? 28 : 40 }}>
          <BrandWordmark width={showEmailLogin ? 176 : 220} />
          <Text className="mt-4 text-center font-sans text-sm text-ink-dark/60">
            {t('auth.tagline')}
          </Text>
        </View>

        <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          {showEmailLogin ? (
            <View>
              <VelveTextInput
                className="mb-4 rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFeedback(null)}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              <VelveTextInput
                ref={passwordRef}
                className="rounded-soft border border-ink-dark/10 bg-surface-panel px-4 py-4 font-sans text-base text-ink-dark"
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFeedback(null)}
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
              />

              {feedback ? (
                <View className="mt-4 rounded-[18px] bg-signal-danger/8 px-4 py-3">
                  <Text
                    className="font-sans text-sm font-semibold leading-6"
                    style={{ color: colors.danger }}
                  >
                    {t('auth.inlineErrorPrefix')}: {feedback.message}
                  </Text>
                  {feedback.recovery ? (
                    <Text className="mt-1 font-sans text-xs leading-5 text-ink-dark/62">
                      {feedback.recovery}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity
                className="mt-5 items-center rounded-pill bg-brand-accent-deep px-4 py-4"
                onPress={handleEmailLogin}
                disabled={loading || remainingSeconds > 0}
              >
                <Text className="font-sans text-base font-semibold text-base-canvas">
                  {loading
                    ? `${t('auth.signIn')}...`
                    : remainingSeconds > 0
                      ? `${t('auth.signIn')} (${remainingSeconds})`
                      : t('auth.signIn')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-3 items-center rounded-pill border border-ink-dark/10 bg-base-canvas/70 px-4 py-4"
                onPress={() => router.push('/(auth)/register')}
              >
                <Text className="font-sans text-base font-medium text-ink-dark">
                  {t('auth.register')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                className={
                  googleSignInAvailable
                    ? 'items-center rounded-pill bg-brand-accent-deep px-4 py-4'
                    : 'items-center rounded-pill bg-brand-accent-deep px-4 py-4 opacity-40'
                }
                onPress={handleGoogleLogin}
                disabled={!googleSignInAvailable}
              >
                <Text
                  className={
                    googleSignInAvailable
                      ? 'font-sans text-base font-semibold text-base-canvas'
                      : 'font-sans text-base font-semibold text-base-canvas'
                  }
                >
                  {t('auth.google')}
                </Text>
              </TouchableOpacity>

              {!googleSignInAvailable && googleSignInUnavailableReason ? (
                <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/60">
                  {googleSignInUnavailableReason}
                </Text>
              ) : null}

              <TouchableOpacity
                className={
                  googleSignInAvailable
                    ? 'mt-3 items-center rounded-pill border border-base-canvas/70 bg-base-canvas/70 px-4 py-4'
                    : 'mt-3 items-center rounded-pill bg-brand-accent-deep px-4 py-4'
                }
                onPress={() => {
                  console.log('[LoginScreen] Switching to email login form');
                  setShowEmailLogin(true);
                }}
              >
                <Text
                  className={
                    googleSignInAvailable
                      ? 'font-sans text-base font-medium text-ink-dark'
                      : 'font-sans text-base font-semibold text-base-canvas'
                  }
                >
                  {t('auth.email')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showEmailLogin ? (
            <TouchableOpacity
              className="mt-5 items-center"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="font-sans text-sm font-semibold text-brand-accent-deep">
                {t('auth.register')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </GlassSurface>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}
