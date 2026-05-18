import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
  isExpectedAuthError,
  type InlineAuthFeedback,
} from '@/lib/authFeedback';

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.trim().split('@');
  if (!domain) return `${localPart.slice(0, 2)}***`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { registerWithEmail } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<InlineAuthFeedback | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<VelveTextInputRef>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function handleRegister() {
    setFeedback(null);
    const normalizedEmail = email.trim();

    if (!validateEmail(normalizedEmail)) {
      console.warn('[RegisterScreen] Registration blocked because email is invalid', {
        email: maskEmail(normalizedEmail),
      });
      setFeedback(getAuthValidationFeedback('invalidEmail', t));
      return;
    }

    if (password.length < 8) {
      console.warn('[RegisterScreen] Registration blocked because password is too short', {
        email: maskEmail(email),
        passwordLength: password.length,
      });
      setFeedback(getAuthValidationFeedback('shortPassword', t));
      return;
    }

    console.log('[RegisterScreen] Register pressed', {
      email: maskEmail(normalizedEmail),
      passwordLength: password.length,
    });
    setLoading(true);
    try {
      await registerWithEmail(normalizedEmail, password);
      console.log('[RegisterScreen] Registration request resolved successfully');
    } catch (e: any) {
      const logger = isExpectedAuthError(e) ? console.warn : console.error;
      logger('[RegisterScreen] Registration failed', {
        code: e?.code,
        message: e?.message,
        nativeErrorCode: e?.nativeErrorCode,
      });
      setFeedback(getAuthInlineFeedback(e, t, 'register'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScreen className="bg-base-canvas" offset={10}>
      <BrandBackground />

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
        <View className="items-center" style={{ marginBottom: 28 }}>
          <BrandWordmark width={176} />
          <Text className="mt-4 text-center font-sans text-sm text-ink-dark/60">
            {t('auth.registerDescription')}
          </Text>
        </View>

        <GlassSurface style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
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
            placeholder={t('auth.passwordLongPlaceholder')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFeedback(null)}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
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
            onPress={handleRegister}
            disabled={loading}
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {loading ? `${t('auth.register')}...` : t('auth.register')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 items-center rounded-pill border border-ink-dark/10 bg-base-canvas/70 px-4 py-4"
            onPress={() => router.back()}
          >
            <Text className="font-sans text-base font-medium text-ink-dark">
              {t('auth.haveAccount')}
            </Text>
          </TouchableOpacity>
        </GlassSurface>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}
