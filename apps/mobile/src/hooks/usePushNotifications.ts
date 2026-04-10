import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'

import client from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

const isExpoGo = Constants.appOwnership === 'expo'

let Notifications: typeof import('expo-notifications') | null = null
let Device: typeof import('expo-device') | null = null

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications')
    Device = require('expo-device')

    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  } catch {
    Notifications = null
    Device = null
  }
}

type NotificationData = {
  type?: string
  chatId?: string
  tradeId?: string
  status?: string
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device) {
    return null
  }

  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications')
    return null
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      return null
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    return tokenData.data
  } catch (error: unknown) {
    console.log('[Push] Registration error:', error instanceof Error ? error.message : 'unknown')
    return null
  }
}

function resolveTradeBucket(data: NotificationData) {
  if (data.type === 'trade_request') return 'pending'
  if (data.type === 'trade_complete' || data.type === 'trade_rating') return 'history'
  if (data.type === 'trade_cancelled' || data.type === 'item_deleted') return 'history'
  if (data.type === 'trade_update' && data.status === 'accepted') return 'active'
  if (data.type === 'trade_update' && ['rejected', 'cancelled', 'expired'].includes(String(data.status))) {
    return 'history'
  }
  if (data.type === 'trade_expired') return 'history'
  return 'pending'
}

export function usePushNotifications() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const notificationListener = useRef<{ remove: () => void } | null>(null)
  const responseListener = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    if (!Notifications || !currentUser) {
      return
    }

    registerForPushNotifications().then(async (token) => {
      if (!token) return

      setExpoPushToken(token)
      try {
        await client.put('/api/users/me/push-token', { token })
      } catch (error: unknown) {
        console.log('[Push] Error saving token:', error instanceof Error ? error.message : 'unknown')
      }
    })

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] Notification received:', notification.request.content.title)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data || {}) as NotificationData

      if (data.type === 'chat_message' && data.chatId) {
        router.push(`/(tabs)/chat/${data.chatId}`)
        return
      }

  if (
    data.type === 'trade_request' ||
    data.type === 'trade_update' ||
    data.type === 'trade_cancelled' ||
    data.type === 'trade_complete' ||
    data.type === 'trade_rating' ||
    data.type === 'trade_expired' ||
    data.type === 'item_deleted'
  ) {
        if (data.chatId) {
          router.push(`/(tabs)/chat/${data.chatId}`)
          return
        }

        router.push('/(tabs)/chat')
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [currentUser, router])

  return { expoPushToken }
}
