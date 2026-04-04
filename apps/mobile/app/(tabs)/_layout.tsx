import { useEffect, useRef, useState } from 'react'
import { Tabs, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/hooks/useAuth'
import { auth as firebaseAuth } from '@/config/firebase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export default function TabsLayout() {
  const { dbUser } = useAuth()
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  // Resetuj badge kad korisnik otvori chat
  useEffect(() => {
    if (pathname.includes('chat')) {
      setUnreadCount(0)
    }
  }, [pathname])

  // Socket.io konekcija — samo za badge, bez pollinga
  useEffect(() => {
    if (!dbUser?._id) return

    let socket: Socket | null = null

    async function connect() {
      const user = firebaseAuth.currentUser
      if (!user) return
      const token = await user.getIdToken()

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
    })
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(246, 248, 237, 0.95)',
          borderTopColor: 'rgba(43, 42, 43, 0.08)',
          elevation: 0,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#431A43',
        tabBarInactiveTintColor: '#2B2A2B80',
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Dodaj',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Poruke',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#431A43', color: '#F6F8ED', fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
    </Tabs>
  )
}
