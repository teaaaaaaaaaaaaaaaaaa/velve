import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  type AlertButton,
  type AlertOptions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '@/design/tokens';
import {
  registerVelveAlertHandler,
  registerVelveToastHandler,
  type VelveToastPayload,
  type VelveToastTone,
} from '@/lib/velveAlert';

type DialogRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

const SUCCESS_TITLES = [
  'hvala',
  'sacuvano',
  'sačuvano',
  'uspeh',
  'obrisano',
  'korisnik blokiran',
  'razmena arhivirana',
  'velve',
];

const ERROR_TITLES = ['greska', 'greška', 'nije moguce', 'nije moguće', 'try-on nije uspeo'];

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function inferToastTone(title: string): VelveToastTone {
  const normalized = normalizeTitle(title);
  if (ERROR_TITLES.some((entry) => normalized.includes(entry))) return 'error';
  if (SUCCESS_TITLES.some((entry) => normalized.includes(entry))) return 'success';
  return 'info';
}

function shouldUseToast(title: string, buttons?: AlertButton[]) {
  const meaningfulButtons = buttons?.filter((button) => button.text && button.text !== 'OK') ?? [];
  if (meaningfulButtons.length > 0) return false;

  const normalized = normalizeTitle(title);
  return (
    SUCCESS_TITLES.some((entry) => normalized.includes(entry)) ||
    ERROR_TITLES.some((entry) => normalized.includes(entry))
  );
}

function normalizeButtons(buttons?: AlertButton[]) {
  if (buttons?.length) return buttons;
  return [{ text: 'OK', style: 'cancel' }] satisfies AlertButton[];
}

function getIconName(tone: VelveToastTone) {
  if (tone === 'success') return 'checkmark-circle';
  if (tone === 'error') return 'alert-circle';
  return 'information-circle';
}

function getDialogTone(dialog: DialogRequest) {
  return dialog.buttons.some((button) => button.style === 'destructive') ? 'danger' : 'default';
}

export function VelveFeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogQueue = useRef<DialogRequest[]>([]);
  const [toast, setToast] = useState<VelveToastPayload | null>(null);
  const toastQueue = useRef<VelveToastPayload[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNextDialog = useCallback(() => {
    const next = dialogQueue.current.shift() ?? null;
    setDialog(next);
  }, []);

  const showToast = useCallback((payload: VelveToastPayload) => {
    const nextPayload = {
      tone: 'info' as VelveToastTone,
      durationMs: 2000,
      ...payload,
    };

    if (toastTimer.current) {
      toastQueue.current.push(nextPayload);
      return;
    }

    setToast(nextPayload);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
      const next = toastQueue.current.shift();
      if (next) showToast(next);
    }, nextPayload.durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const unregisterAlert = registerVelveAlertHandler((title, message, buttons, options) => {
      if (shouldUseToast(title, buttons)) {
        showToast({ title, message, tone: inferToastTone(title), durationMs: 2000 });
        return;
      }

      const nextDialog = {
        title,
        message,
        buttons: normalizeButtons(buttons),
        options,
      };

      setDialog((current) => {
        if (current) {
          dialogQueue.current.push(nextDialog);
          return current;
        }
        return nextDialog;
      });
    });

    const unregisterToast = registerVelveToastHandler(showToast);

    return () => {
      unregisterAlert();
      unregisterToast();
    };
  }, [showToast]);

  const orderedButtons = useMemo(() => {
    if (!dialog) return [];
    const cancelButtons = dialog.buttons.filter((button) => button.style === 'cancel');
    const actionButtons = dialog.buttons.filter((button) => button.style !== 'cancel');
    return [...actionButtons, ...cancelButtons];
  }, [dialog]);

  const closeDialog = useCallback(
    (button?: AlertButton) => {
      setDialog(null);
      requestAnimationFrame(() => {
        button?.onPress?.();
        showNextDialog();
      });
    },
    [showNextDialog]
  );

  const dialogTone = dialog ? getDialogTone(dialog) : 'default';
  const toastTone = toast?.tone ?? 'info';

  return (
    <View className="flex-1">
      {children}

      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (dialog?.options?.cancelable === false) return;
          const cancelButton = dialog?.buttons.find((button) => button.style === 'cancel');
          closeDialog(cancelButton);
        }}
      >
        <View className="flex-1 justify-end bg-ink-dark/45 px-4 pb-4">
          <Pressable
            className="absolute inset-0"
            onPress={() => {
              if (dialog?.options?.cancelable === false) return;
              const cancelButton = dialog?.buttons.find((button) => button.style === 'cancel');
              closeDialog(cancelButton);
            }}
          />

          {dialog ? (
            <View
              className="rounded-[28px] border border-base-canvas/70 bg-surface-panel px-5 pb-5 pt-5"
              style={[shadows.floating, { marginBottom: Math.max(insets.bottom, 8) }]}
            >
              <View className="mb-4 flex-row items-start gap-3">
                <View
                  className={`h-11 w-11 items-center justify-center rounded-full ${
                    dialogTone === 'danger' ? 'bg-signal-danger/12' : 'bg-brand-accent-light/25'
                  }`}
                >
                  <Ionicons
                    name={dialogTone === 'danger' ? 'alert-circle' : 'sparkles'}
                    size={22}
                    color={dialogTone === 'danger' ? colors.danger : colors.accentDeep}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-2xl leading-8 text-ink-dark">
                    {dialog.title}
                  </Text>
                  {dialog.message ? (
                    <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/62">
                      {dialog.message}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="gap-2">
                {orderedButtons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';

                  return (
                    <TouchableOpacity
                      key={`${button.text ?? 'action'}-${index}`}
                      accessibilityRole="button"
                      onPress={() => closeDialog(button)}
                      className={`items-center rounded-full px-4 py-4 ${
                        isCancel
                          ? 'border border-ink-dark/10 bg-base-canvas/70'
                          : isDestructive
                            ? 'bg-signal-danger'
                            : 'bg-brand-accent-deep'
                      }`}
                    >
                      <Text
                        className={`font-sans text-base font-semibold ${
                          isCancel ? 'text-ink-dark' : 'text-base-canvas'
                        }`}
                      >
                        {button.text ?? 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {toast ? (
        <View
          pointerEvents="none"
          className="absolute left-4 right-4 z-50"
          style={{ top: insets.top + 12 }}
        >
          <View
            className={`flex-row items-start rounded-[22px] border px-4 py-3 ${
              toastTone === 'success'
                ? 'border-brand-highlight/50 bg-base-canvas'
                : toastTone === 'error'
                  ? 'border-signal-danger/20 bg-surface-panel'
                  : 'border-brand-accent-light/45 bg-surface-panel'
            }`}
            style={shadows.glass}
          >
            <Ionicons
              name={getIconName(toastTone)}
              size={20}
              color={toastTone === 'error' ? colors.danger : colors.accentDeep}
            />
            <View className="ml-3 flex-1">
              <Text className="font-sans text-sm font-semibold text-ink-dark">{toast.title}</Text>
              {toast.message ? (
                <Text className="mt-0.5 font-sans text-xs leading-5 text-ink-dark/62">
                  {toast.message}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
