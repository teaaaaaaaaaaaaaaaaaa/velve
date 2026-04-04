import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import client from '@/api/client'

// Check if running in Expo Go (push not supported since SDK 53)
const isExpoGo = Constants.appOwnership === 'expo'

// Lazy import to avoid crash in Expo Go
let Notifications: typeof import('expo-notifications') | null = null
let Device: typeof import('expo-device') | null = null

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications')
    Device = require('expo-device')

    // Configure notification behavior
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
    }
  } catch (e) {
    console.log('[Push] expo-notifications not available')
  }
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device) {
    console.log('[Push] Skipping - not available in Expo Go')
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
      console.log('[Push] Permission not granted')
      return null
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })

    console.log('[Push] Token:', tokenData.data)

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    return tokenData.data
  } catch (err: any) {
    console.log('[Push] Registration error:', err.message)
    return null
  }
}

export function usePushNotifications() {
  const router = useRouter()
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const notificationListener = useRef<any>(null)
  const responseListener = useRef<any>(null)

  useEffect(() => {
    if (!Notifications) {
      console.log('[Push] Notifications disabled in Expo Go')
      return
    }

    // Register and save token
    registerForPushNotifications().then(async (token) => {
      if (token) {
        setExpoPushToken(token)
        try {
          await client.put('/api/users/me/push-token', { token })
          console.log('[Push] Token saved to server')
        } catch (err: any) {
          console.log('[Push] Error saving token:', err.message)
        }
      }
    })

    // Handle incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Push] Notification received:', notification.request.content.title)
      }
    )

    // Handle tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data
        console.log('[Push] Notification tapped:', data)

        if (data?.type === 'chat_message' && data?.chatId) {
          router.push(`/(tabs)/chat/${data.chatId}`)
        } else if (data?.type === 'trade_request') {
          router.push('/(tabs)/chat')
        }
      }
    )

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [])

  return { expoPushToken }
}
