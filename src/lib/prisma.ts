import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Create a Prisma client with MariaDB adapter
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || '',
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER || '',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
    connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || "5"),
    ssl: false,
    logger: {
      error: (err) => logger.error('PrismaMariaDb error:', err),
    },
  });

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    adapter
  })

  // Enhanced connection health check (server-side only)
  if (typeof window === 'undefined') {
    client.$connect()
      .then(() => {
        logger.info('✅ Database connected successfully')
      })
      .catch((error) => {
        logger.error('❌ Database connection failed:', { error })
        // In production, you might want to implement retry logic here
      })

    // Graceful shutdown - only log disconnection in production to reduce noise in development
    if (typeof process !== 'undefined') {
      let isDisconnected = false;

      const handleDisconnect = async () => {
        if (!isDisconnected) {
          isDisconnected = true;
          await client.$disconnect();
          // Only log disconnection in production to reduce development noise
          if (process.env.NODE_ENV === 'production') {
            logger.info('📴 Database disconnected');
          }
        }
      };

      // Use multiple exit events to ensure proper cleanup
      process.on('beforeExit', handleDisconnect);
      process.on('SIGINT', handleDisconnect);
      process.on('SIGTERM', handleDisconnect);
      process.on('exit', handleDisconnect);
    }
  }

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
