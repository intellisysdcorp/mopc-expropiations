import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { verify } from 'jsonwebtoken';
import { prisma } from './prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

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
        const decoded = verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret') as any;

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
        (socket as any).departmentId = user.departmentId;

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
      const role = (socket as any).userRole;
      socket.join(`role:${role}`);
      this.userRooms.get(userId)!.add(`role:${role}`);

      // Track connection in database
      this.trackConnection(socket, 'connected');

      // Handle joining additional rooms
      socket.on('join-room', (room: string) => {
        if (this.validateRoomAccess(userId, room)) {
          socket.join(room);
          this.userRooms.get(userId)!.add(room);
          socket.emit('room-joined', { room });
        } else {
          socket.emit('error', { message: 'Access denied to room' });
        }
      });

      // Handle leaving rooms
      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        this.userRooms.get(userId)!.delete(room);
        socket.emit('room-left', { room });
      });

      // Handle custom notifications
      socket.on('send-notification', async (data: NotificationData) => {
        try {
          await this.sendNotification(data);
        } catch (error) {
          socket.emit('error', { message: 'Failed to send notification' });
        }
      });

      // Handle presence updates
      socket.on('presence-update', (data: any) => {
        socket.broadcast.to(`department:${departmentId}`).emit('presence-update', {
          userId,
          status: data.status,
          timestamp: new Date()
        });
      });

      // Handle typing indicators
      socket.on('typing-start', (data: { room: string }) => {
        socket.to(data.room).emit('typing-start', {
          userId,
          userEmail,
          timestamp: new Date()
        });
      });

      socket.on('typing-stop', (data: { room: string }) => {
        socket.to(data.room).emit('typing-stop', {
          userId,
          timestamp: new Date()
        });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`User ${userEmail} disconnected (${socket.id}): ${reason}`);
        this.handleDisconnection(socket);
      });

      // Send initial notification count
      this.sendUnreadCount(userId);

      // Send welcome message
      socket.emit('connected', {
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

  private handleDisconnection(socket: any): void {
    const userId = socket.userId;
    const socketId = socket.id;

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
    socket.broadcast.to(`department:${socket.departmentId}`).emit('presence-update', {
      userId,
      status: 'offline',
      timestamp: new Date()
    });
  }

  private async trackConnection(socket: any, status: string): Promise<void> {
    try {
      const connectionData = {
        userId: socket.userId,
        socketId: socket.id,
        connectionId: socket.id,
        status,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        connectedAt: status === 'connected' ? new Date() : undefined,
        disconnectedAt: status === 'disconnected' ? new Date() : undefined,
        metadata: {
          serverId: process.env.SERVER_ID || 'default',
          version: process.env.npm_package_version || '1.0.0'
        }
      };

      if (status === 'connected') {
        await prisma.webSocketConnection.create({
          data: connectionData
        });
      } else {
        await prisma.webSocketConnection.updateMany({
          where: {
            socketId: socket.id,
            userId: socket.userId
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
      this.io.to(`user:${data.userId}`).emit('notification', {
        type: 'notification',
        data,
        timestamp: new Date(),
        id: uuidv4()
      });

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
            timestamp: new Date()
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