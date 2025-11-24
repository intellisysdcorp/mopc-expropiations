import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeWebSocket } from '@/lib/websocket-server';
import { logger } from '@/lib/logger';

interface EnhancedNextApiResponse extends NextApiResponse {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

const SocketHandler = (req: NextApiRequest, res: EnhancedNextApiResponse) => {
  if (res.socket.server.io) {
    logger.info('Socket.IO server already running');
    res.end();
    return;
  }

  logger.info('Initializing Socket.IO server...');

  const httpServer: NetServer = res.socket.server;
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXTAUTH_URL
        : ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Initialize our WebSocket server
  initializeWebSocket(httpServer);

  res.socket.server.io = io;
  res.end();
};

export default SocketHandler;