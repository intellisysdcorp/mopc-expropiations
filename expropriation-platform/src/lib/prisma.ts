import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Prisma 7: Use adapter for SQLite connection
    adapter: new PrismaLibSql({
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    }),
  })

  // Enhanced connection health check (server-side only)
  if (typeof window === 'undefined') {
    client.$connect()
      .then(() => {
        logger.info('✅ Database connected successfully')
      })
      .catch((error) => {
        logger.error('❌ Database connection failed:', error)
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