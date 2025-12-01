import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeWebSocket } from '@/lib/websocket-server';
import { logger } from '@/lib/logger';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SocketHandler = (_req: NextApiRequest, res: NextApiResponse) => {
  // Type assertion for Next.js API socket with server property
  const socket = res.socket as any;

  if (socket?.server?.io) {
    logger.info('Socket.IO server already running');
    res.end();
    return;
  }

  logger.info('Initializing Socket.IO server...');

  // Ensure socket exists and get the server
  if (!socket) {
    res.status(500).end('Socket not available');
    return;
  }

  const httpServer: NetServer = socket.server;
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.NEXTAUTH_URL || "http://localhost:3000")
        : ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Initialize our WebSocket server
  initializeWebSocket(httpServer);

  // Store the Socket.IO server instance
  socket.server.io = io;
  res.end();
};

export default SocketHandler;