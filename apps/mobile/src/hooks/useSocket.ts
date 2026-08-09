import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_URL } from '@/config/api';
import { auth, getAuthToken } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

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
        logger.debug('[Socket] Connecting to:', API_URL);

        socket = io(API_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
          logger.debug('[Socket] Connected');
          setConnected(true);
        });

        socket.on('disconnect', () => {
          logger.debug('[Socket] Disconnected');
          setConnected(false);
        });

        socket.on('connect_error', (err) => {
          logger.warn('[Socket] Connection error:', err.message);
          setConnected(false);
        });

        socketRef.current = socket;
      } catch (unknownError: unknown) {
        const error = unknownError as { message?: string };
        logger.warn('[Socket] Skipping connection', {
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
