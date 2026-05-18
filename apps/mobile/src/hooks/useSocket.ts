import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_URL } from '@/config/api';
import { auth, getAuthToken } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';

export function useSocket() {
  const { currentUser } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: Socket | null = null;

    async function connect() {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const token = await getAuthToken(user);
        console.log('[Socket] Connecting to:', API_URL);

        socket = io(API_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
          console.log('[Socket] Connected');
          setConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('[Socket] Disconnected');
          setConnected(false);
        });

        socket.on('connect_error', (err) => {
          console.log('[Socket] Connection error:', err.message);
          setConnected(false);
        });

        socketRef.current = socket;
      } catch (error: any) {
        console.warn('[Socket] Skipping connection', {
          message: error?.message,
          currentUserUid: auth.currentUser?.uid ?? null,
        });
      }
    }

    if (!currentUser?.uid) {
      setConnected(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    connect();

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser?.uid]);

  return { socket: socketRef.current, connected };
}
