import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    // Only allow super admins to access system stats
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user statistics
    const totalUsers = await prisma.user.count()
    const activeUsers = await prisma.user.count({
      where: {
        isActive: true,
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    // Get case statistics
    const totalCases = await prisma.case.count()
    const pendingCases = await prisma.case.count({
      where: {
        status: {
          in: ['PENDIENTE', 'EN_PROGRESO']
        }
      }
    })

    // Get system health checks
    const healthChecks = await prisma.systemHealthCheck.findMany({
      where: {
        isActive: true
      },
      take: 10,
      orderBy: {
        lastCheckedAt: 'desc'
      }
    })

    // Determine overall system health
    const criticalIssues = healthChecks.filter(check => check.status === 'critical').length
    const warningIssues = healthChecks.filter(check => check.status === 'warning').length

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalIssues > 0) {
      systemHealth = 'critical'
    } else if (warningIssues > 0) {
      systemHealth = 'warning'
    }

    // Get last backup information
    const lastBackup = await prisma.backupJob.findFirst({
      where: {
        status: 'completed'
      },
      orderBy: {
        completedAt: 'desc'
      },
      select: {
        completedAt: true,
        backupSize: true
      }
    })

    // Calculate database size (approximation)
    const databaseSize = await getDatabaseSize()

    // Get system uptime (simulated for now)
    const uptime = '7 días, 14 horas'

    // Get recent error rate
    const recentErrors = await prisma.systemLog.count({
      where: {
        level: 'ERROR',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    const totalLogs = await prisma.systemLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    const errorRate = totalLogs > 0 ? (recentErrors / totalLogs) * 100 : 0

    const stats = {
      totalUsers,
      activeUsers,
      totalCases,
      pendingCases,
      systemHealth,
      lastBackup: lastBackup?.completedAt?.toISOString() || null,
      uptime,
      databaseSize,
      errorRate: Math.round(errorRate * 100) / 100
    }

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getDatabaseSize(): Promise<string> {
  try {
    // For SQLite, we can get the file size
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

    // Use fs.promises for async operations
    const stats = await fs.stat(dbPath)
    const sizeInBytes = stats.size
    const sizeInMB = sizeInBytes / (1024 * 1024)
    return `${sizeInMB.toFixed(2)} MB`
  } catch (error) {
    logger.error('Error getting database size:', error)
    return 'N/A'
  }
}