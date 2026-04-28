import { useEffect, useRef, useState } from 'react'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'
import { View } from 'react-native'
import client from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { auth as firebaseAuth, getAuthToken } from '@/config/firebase'
import { API_URL } from '@/config/api'
import { colors, fonts, shadows } from '@/design/tokens'
import { useI18n } from '@/i18n'

export default function TabsLayout() {
  const { dbUser } = useAuth()
  const { t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  // Hide only inside a specific conversation (e.g. /chat/<id>). The chat list
  // (/chat), closet, and trades keep the floating nav visible.
  const hideFloatingBar = /\/chat\/[^/]+$/.test(pathname)

  // Resetuj badge kad korisnik otvori chat
  useEffect(() => {
    if (pathname.includes('chat')) {
      setUnreadCount(0)
    }
  }, [pathname])

  useEffect(() => {
    if (!dbUser?._id) {
      setNotificationUnreadCount(0)
      return
    }

    let active = true

    async function loadNotificationBadge() {
      try {
        const response = await client.get('/api/notifications/unread-count')
        if (active && response.data.ok) {
          setNotificationUnreadCount(response.data.unreadCount || response.data.data?.unreadCount || 0)
        }
      } catch {
        // Badge should never block tab navigation.
      }
    }

    loadNotificationBadge()
    const interval = setInterval(loadNotificationBadge, 60000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [dbUser?._id, pathname])

  // Socket.io konekcija — samo za badge, bez pollinga
  useEffect(() => {
    if (!dbUser?._id) return

    let socket: Socket | null = null

    async function connect() {
      const user = firebaseAuth.currentUser
      if (!user) return
      const token = await getAuthToken(user)

      socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 3000,
      })

      socket.on('badge_new_message', () => {
        // Dodaj badge samo ako korisnik nije trenutno u chat tabu
        if (!pathname.includes('chat')) {
          setUnreadCount((prev) => prev + 1)
        }
        setNotificationUnreadCount((prev) => prev + 1)
      })

      socketRef.current = socket
    }

    connect()

    return () => {
      socket?.disconnect()
      socketRef.current = null
    }
  }, [dbUser?._id])

  // Ažuriraj pathname ref u socket listeneru
  useEffect(() => {
    if (!socketRef.current) return
    socketRef.current.off('badge_new_message')
    socketRef.current.on('badge_new_message', () => {
      if (!pathname.includes('chat')) {
        setUnreadCount((prev) => prev + 1)
      }
      setNotificationUnreadCount((prev) => prev + 1)
    })
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View
            className="mx-3 mb-3 flex-1 rounded-editorial border border-base-canvas/70 bg-base-canvas/80"
            style={shadows.floating}
          />
        ),
        tabBarStyle: {
          display: hideFloatingBar ? 'none' : 'flex',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 92,
          paddingBottom: 16,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarLabelStyle: {
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: t('tabs.feed'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: t('tabs.upload'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (event) => {
            // Fabric crashes (addViewAt) when redirecting from a tab screen
            // via router.replace inside useEffect. Intercept the tab tap and
            // navigate directly so the upload tab itself never mounts.
            event.preventDefault()
            router.push('/upload-flow')
          },
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: t('tabs.chat'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accentDeep,
            color: colors.baseCanvas,
            fontSize: 10,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarBadge: notificationUnreadCount > 0 ? notificationUnreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.highlight,
            color: colors.inkDark,
            fontSize: 10,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="trades" options={{ href: null }} />
      <Tabs.Screen name="closet" options={{ href: null }} />
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
    </Tabs>
  )
}
