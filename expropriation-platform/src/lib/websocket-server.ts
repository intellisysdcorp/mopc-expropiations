import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verify } from 'jsonwebtoken';
import { prisma } from './prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

// Note: Socket authentication data is stored directly on the socket object

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: string;
  departmentId: string;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface PresenceData {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  timestamp: Date;
}

export interface TypingData {
  userId: string;
  userEmail?: string;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'notification' | 'system' | 'presence' | 'typing' | 'custom';
  data: NotificationData | PresenceData | TypingData | Record<string, unknown>;
  room?: string;
  timestamp: Date;
  id: string;
}

// Note: This interface is for internal type checking, not directly used with Prisma
export interface ConnectionData {
  userId: string;
  socketId: string;
  connectionId: string;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  connectedAt?: Date;
  disconnectedAt?: Date;
  metadata: Record<string, string>;
}

export interface RoomAccessRequest {
  room: string;
}

export interface CustomNotificationRequest {
  type: 'notification';
  data: NotificationData;
  room?: string;
  timestamp: Date;
  id: string;
}

export interface PresenceUpdateRequest {
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface TypingRequest {
  room: string;
}

class WebSocketNotificationServer {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> rooms
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupHeartbeat();
  }

  public initialize(server: HttpServer): void {
    if (this.io) {
      logger.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.NEXTAUTH_URL
          : ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket server initialized');
  }

  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token (you'll need to use your NextAuth secret)
        const decoded = verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret') as { email: string };

        // Get user from database
        const user = await prisma.user.findUnique({
          where: { email: decoded.email },
          include: {
            department: true,
            role: true
          }
        });

        if (!user || !user.isActive) {
          return next(new Error('Invalid user'));
        }

        // Store user info on socket
        (socket as any).userId = user.id;
        (socket as any).userEmail = user.email;
        (socket as any).userRole = user.role.name;
        (socket as any).departmentId = user.departmentId || '';

        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const userId = (socket as any).userId;
      const userEmail = (socket as any).userEmail;
      const departmentId = (socket as any).departmentId;
      const userRole = (socket as any).userRole;

      logger.info(`User ${userEmail} connected (${socket.id})`);

      // Track connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);
      this.socketUsers.set(socket.id, userId);

      // Initialize user rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }

      // Join default rooms
      socket.join(`user:${userId}`);
      socket.join(`department:${departmentId}`);
      this.userRooms.get(userId)!.add(`user:${userId}`);
      this.userRooms.get(userId)!.add(`department:${departmentId}`);

      // Join role-based rooms
      socket.join(`role:${userRole}`);
      this.userRooms.get(userId)!.add(`role:${userRole}`);

      // Track connection in database
      this.trackConnection(socket, 'connected');

      // Handle joining additional rooms
      socket.on('join-room', (data: RoomAccessRequest) => {
        if (this.validateRoomAccess(userId, data.room)) {
          socket.join(data.room);
          this.userRooms.get(userId)!.add(data.room);
          (socket as any).emit('room-joined', { room: data.room });
        } else {
          (socket as any).emit('error', { message: 'Access denied to room' });
        }
      });

      // Handle leaving rooms
      socket.on('leave-room', (data: RoomAccessRequest) => {
        socket.leave(data.room);
        this.userRooms.get(userId)!.delete(data.room);
        (socket as any).emit('room-left', { room: data.room });
      });

      // Handle custom notifications
      socket.on('send-notification', async (data: NotificationData) => {
        try {
          await this.sendNotification(data);
        } catch (error) {
          logger.error('Failed to send notification:', error);
          (socket as any).emit('error', { message: 'Failed to send notification' });
        }
      });

      // Handle presence updates
      socket.on('presence-update', (data: PresenceUpdateRequest) => {
        const presenceData: PresenceData = {
          userId,
          status: data.status,
          timestamp: new Date()
        };
        socket.broadcast.to(`department:${departmentId}`).emit('presence-update' as any, presenceData);
      });

      // Handle typing indicators
      socket.on('typing-start', (data: TypingRequest) => {
        const typingData: TypingData = {
          userId,
          userEmail,
          timestamp: new Date()
        };
        socket.to(data.room).emit('typing-start' as any, typingData);
      });

      socket.on('typing-stop', (data: TypingRequest) => {
        const typingData: TypingData = {
          userId,
          timestamp: new Date()
        };
        socket.to(data.room).emit('typing-stop' as any, typingData);
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        logger.info(`User ${userEmail} disconnected (${socket.id}): ${reason}`);
        this.handleDisconnection(socket);
      });

      // Send initial notification count
      this.sendUnreadCount(userId);

      // Send welcome message
      (socket as any).emit('connected', {
        message: 'Connected to notification server',
        userId,
        timestamp: new Date()
      });
    });
  }

  private validateRoomAccess(userId: string, room: string): boolean {
    // Room access validation logic
    const userRooms = this.userRooms.get(userId);
    if (!userRooms) return false;

    // Allow access to user's own rooms and department rooms
    if (room.startsWith(`user:${userId}`) || room.startsWith('department:')) {
      return true;
    }

    // Add additional room validation logic as needed
    return true;
  }

  private handleDisconnection(socket: Socket): void {
    const userId = (socket as any).userId;
    const socketId = socket.id;
    const departmentId = (socket as any).departmentId;

    // Remove from tracking
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        this.userRooms.delete(userId);
      }
    }
    this.socketUsers.delete(socketId);

    // Update connection status in database
    this.trackConnection(socket, 'disconnected');

    // Notify other users about presence change
    const presenceData: PresenceData = {
      userId,
      status: 'offline',
      timestamp: new Date()
    };
    socket.broadcast.to(`department:${departmentId}`).emit('presence-update' as any, presenceData);
  }

  private async trackConnection(socket: Socket, status: string): Promise<void> {
    try {
      const userId = (socket as any).userId;
      const ipAddress = socket.handshake.address || null;
      const userAgent = socket.handshake.headers['user-agent'] || null;

      if (status === 'connected') {
        await prisma.webSocketConnection.create({
          data: {
            userId: String(userId),
            socketId: socket.id,
            connectionId: socket.id,
            status: String(status),
            ipAddress,
            userAgent,
            connectedAt: new Date(),
            metadata: {
              serverId: process.env.SERVER_ID || 'default',
              version: process.env.npm_package_version || '1.0.0'
            }
          }
        });
      } else {
        await prisma.webSocketConnection.updateMany({
          where: {
            socketId: socket.id,
            userId: String(userId)
          },
          data: {
            status: 'disconnected',
            disconnectedAt: new Date()
          }
        });
      }
    } catch (error) {
      logger.error('Error tracking WebSocket connection:', error);
    }
  }

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.io) {
        this.io.emit('heartbeat', { timestamp: new Date() });
      }
    }, 30000); // Every 30 seconds
  }

  public async sendNotification(data: NotificationData): Promise<void> {
    if (!this.io) return;

    try {
      // Send to specific user
      const notificationMessage: WebSocketMessage = {
        type: 'notification',
        data,
        timestamp: new Date(),
        id: uuidv4()
      };

      this.io.to(`user:${data.userId}`).emit('notification', notificationMessage);

      // Update database with notification status
      await prisma.notificationHistory.create({
        data: {
          notificationId: data.id,
          eventType: 'sent',
          status: 'success',
          channel: 'websocket',
          eventAt: new Date(),
          metadata: {
            method: 'realtime',
            timestamp: new Date(),
            socketServer: 'realtime'
          }
        }
      });
    } catch (error) {
      logger.error('Error sending WebSocket notification:', error);
    }
  }

  public async sendToRoom(room: string, message: WebSocketMessage): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to(room).emit(message.type, message);
    } catch (error) {
      logger.error('Error sending message to room:', error);
    }
  }

  public async sendToUsers(userIds: string[], message: WebSocketMessage): Promise<void> {
    if (!this.io) return;

    try {
      const rooms = userIds.map(userId => `user:${userId}`);
      rooms.forEach(room => {
        this.io!.to(room).emit(message.type, message);
      });
    } catch (error) {
      logger.error('Error sending message to users:', error);
    }
  }

  public async sendToDepartment(departmentId: string, message: WebSocketMessage): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to(`department:${departmentId}`).emit(message.type, message);
    } catch (error) {
      logger.error('Error sending message to department:', error);
    }
  }

  public async sendToRole(role: string, message: WebSocketMessage): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to(`role:${role}`).emit(message.type, message);
    } catch (error) {
      logger.error('Error sending message to role:', error);
    }
  }

  private async sendUnreadCount(userId: string): Promise<void> {
    try {
      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      });

      this.io?.to(`user:${userId}`).emit('unread-count', {
        count: unreadCount,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error sending unread count:', error);
    }
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  public broadcast(message: WebSocketMessage): void {
    if (!this.io) return;
    this.io.emit(message.type, message);
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}

// Singleton instance
export const wsServer = new WebSocketNotificationServer();

// Helper functions for API routes
export const initializeWebSocket = (server: HttpServer): void => {
  wsServer.initialize(server);
};

export const sendRealtimeNotification = async (data: NotificationData): Promise<void> => {
  await wsServer.sendNotification(data);
};

export const broadcastToDepartment = async (departmentId: string, message: WebSocketMessage): Promise<void> => {
  await wsServer.sendToDepartment(departmentId, message);
};

export const broadcastToRole = async (role: string, message: WebSocketMessage): Promise<void> => {
  await wsServer.sendToRole(role, message);
};