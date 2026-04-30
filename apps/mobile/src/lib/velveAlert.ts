import type { AlertButton, AlertOptions } from 'react-native'

export type VelveToastTone = 'success' | 'error' | 'info'

export type VelveToastPayload = {
  title: string
  message?: string
  tone?: VelveToastTone
  durationMs?: number
}

export type VelveAlertHandler = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => void

export type VelveToastHandler = (payload: VelveToastPayload) => void

let alertHandler: VelveAlertHandler | null = null
let toastHandler: VelveToastHandler | null = null
const pendingAlerts: Parameters<VelveAlertHandler>[] = []
const pendingToasts: VelveToastPayload[] = []

export function registerVelveAlertHandler(handler: VelveAlertHandler) {
  alertHandler = handler
  while (pendingAlerts.length > 0) {
    const args = pendingAlerts.shift()
    if (args) handler(...args)
  }

  return () => {
    if (alertHandler === handler) alertHandler = null
  }
}

export function registerVelveToastHandler(handler: VelveToastHandler) {
  toastHandler = handler
  while (pendingToasts.length > 0) {
    const payload = pendingToasts.shift()
    if (payload) handler(payload)
  }

  return () => {
    if (toastHandler === handler) toastHandler = null
  }
}

export function showVelveToast(payload: VelveToastPayload) {
  if (toastHandler) {
    toastHandler(payload)
    return
  }

  pendingToasts.push(payload)
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    if (alertHandler) {
      alertHandler(title, message, buttons, options)
      return
    }

    pendingAlerts.push([title, message, buttons, options])
  },
}
