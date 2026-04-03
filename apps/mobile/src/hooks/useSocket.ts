import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { auth } from '@/config/firebase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let socket: Socket | null = null

    async function connect() {
      const user = auth.currentUser
      if (!user) return

      const token = await user.getIdToken()

      socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      })

      socket.on('connect', () => {
        console.log('[Socket] Connected')
        setConnected(true)
      })

      socket.on('disconnect', () => {
        console.log('[Socket] Disconnected')
        setConnected(false)
      })

      socket.on('connect_error', (err) => {
        console.log('[Socket] Connection error:', err.message)
        setConnected(false)
      })

      socketRef.current = socket
    }

    connect()

    return () => {
      if (socket) {
        socket.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  return { socket: socketRef.current, connected }
}
