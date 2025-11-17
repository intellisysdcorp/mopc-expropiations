'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  userId: string;
  metadata?: any;
  createdAt: Date;
}

export interface WebSocketMessage {
  type: 'notification' | 'system' | 'presence' | 'typing' | 'custom';
  data: any;
  room?: string;
  timestamp: Date;
  id: string;
}

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  notifications: NotificationData[];
  unreadCount: number;
  onlineUsers: string[];
  typingUsers: Map<string, { timestamp: Date; room: string }>;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendNotification: (data: NotificationData) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  sendMessage: (message: WebSocketMessage) => void;
  sendTypingStart: (room: string) => void;
  sendTypingStop: (room: string) => void;
  clearNotifications: () => void;
  markAsRead: (notificationId: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, { timestamp: Date; room: string }>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!session?.user) {
      clientLogger.warn('Cannot connect WebSocket: no session');
      return;
    }

    if (socketRef.current?.connected) {
      clientLogger.info('WebSocket already connected');
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const newSocket = io({
        path: '/api/socket/io',
        addTrailingSlash: false,
        auth: {
          token: session.accessToken || 'fallback-token' // You'll need to get the actual token
        },
        reconnection,
        reconnectionAttempts,
        reconnectionDelay,
        timeout: 20000,
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connection events
      newSocket.on('connect', () => {
        clientLogger.info('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);

        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Start heartbeat
        startHeartbeat();
      });

      newSocket.on('disconnect', (reason) => {
        clientLogger.info('WebSocket disconnected:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        stopHeartbeat();

        // Auto-reconnect if not intentionally disconnected
        if (reason !== 'io client disconnect' && reconnection) {
          scheduleReconnect();
        }
      });

      newSocket.on('connect_error', (err) => {
        clientLogger.error('WebSocket connection error:', err);
        setIsConnected(false);
        setConnectionStatus('error');
        setError(err.message);
        stopHeartbeat();

        if (reconnection) {
          scheduleReconnect();
        }
      });

      // Notification events
      newSocket.on('notification', (data: { type: string; data: NotificationData; timestamp: Date; id: string }) => {
        clientLogger.info('Received notification:', data);

        const notification = data.data;
        setNotifications(prev => [notification, ...prev]);

        if (!notification.readAt) {
          setUnreadCount(prev => prev + 1);

          // Show toast notification
          toast.success(notification.title, {
            description: notification.message,
            duration: 5000,
            icon: getNotificationIcon(notification.type),
          });
        }
      });

      // Unread count updates
      newSocket.on('unread-count', (data: { count: number; timestamp: Date }) => {
        setUnreadCount(data.count);
      });

      // System messages
      newSocket.on('system', (message: WebSocketMessage) => {
        clientLogger.info('System message:', message);

        if (message.data.level === 'error') {
          toast.error(message.data.message);
        } else if (message.data.level === 'warning') {
          toast(message.data.message);
        } else {
          toast.success(message.data.message);
        }
      });

      // Presence updates
      newSocket.on('presence-update', (data: { userId: string; status: string; timestamp: Date }) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          if (data.status === 'online') {
            updated.add(data.userId);
          } else {
            updated.delete(data.userId);
          }
          return Array.from(updated);
        });
      });

      // Typing indicators
      newSocket.on('typing-start', (data: { userId: string; userEmail: string; timestamp: Date; room: string }) => {
        setTypingUsers(prev => {
          const updated = new Map(prev);
          updated.set(data.userId, { timestamp: data.timestamp, room: data.room });
          return updated;
        });

        // Clear typing indicator after 5 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const updated = new Map(prev);
            updated.delete(data.userId);
            return updated;
          });
        }, 5000);
      });

      newSocket.on('typing-stop', (data: { userId: string; timestamp: Date }) => {
        setTypingUsers(prev => {
          const updated = new Map(prev);
          updated.delete(data.userId);
          return updated;
        });
      });

      // Heartbeat
      newSocket.on('heartbeat', (data: { timestamp: Date }) => {
        // Respond to server heartbeat
        newSocket.emit('heartbeat-response', {
          timestamp: new Date(),
          userId: session.user.id
        });
      });

      // Room events
      newSocket.on('room-joined', (data: { room: string }) => {
        clientLogger.info(`Joined room: ${data.room}`);
      });

      newSocket.on('room-left', (data: { room: string }) => {
        clientLogger.info(`Left room: ${data.room}`);
      });

      // Error handling
      newSocket.on('error', (err: any) => {
        clientLogger.error('WebSocket error:', err);
        toast.error('Error de conexión en tiempo real');
        setError(err.message || 'Unknown error');
      });

    } catch (err) {
      clientLogger.error('Error creating WebSocket connection:', err);
      setConnectionStatus('error');
      setError('Failed to create WebSocket connection');
    }
  }, [session, reconnection, reconnectionAttempts, reconnectionDelay]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    stopHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    reconnectTimeoutRef.current = setTimeout(() => {
      clientLogger.info('Attempting to reconnect WebSocket...');
      connect();
    }, reconnectionDelay);
  }, [connect, reconnectionDelay]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('heartbeat-ping', { timestamp: new Date() });
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const sendNotification = useCallback((data: NotificationData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send-notification', data);
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-room', room);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room', room);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', message);
    }
  }, []);

  const sendTypingStart = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing-start', { room });
    }
  }, []);

  const sendTypingStop = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing-stop', { room });
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId
          ? { ...n, isRead: true, readAt: new Date() }
          : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Auto-connect when session is available
  useEffect(() => {
    if (autoConnect && session?.user && status === 'authenticated') {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, session, status, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    connectionStatus,
    notifications,
    unreadCount,
    onlineUsers,
    typingUsers,
    error,
    connect,
    disconnect,
    sendNotification,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    clearNotifications,
    markAsRead,
  };
};

// Helper function to get notification icon
const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'SUCCESS':
    case 'success':
      return '✅';
    case 'ERROR':
    case 'error':
      return '❌';
    case 'WARNING':
    case 'warning':
      return '⚠️';
    case 'INFO':
    case 'info':
      return 'ℹ️';
    case 'TASK_ASSIGNED':
    case 'task_assigned':
      return '📋';
    case 'DEADLINE_REMINDER':
    case 'deadline_reminder':
      return '⏰';
    case 'STATUS_UPDATE':
    case 'status_update':
      return '📊';
    case 'SYSTEM_ANNOUNCEMENT':
    case 'system_announcement':
      return '📢';
    default:
      return '🔔';
  }
};

export default useWebSocket;