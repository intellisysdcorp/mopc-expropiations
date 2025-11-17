import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Only allow super admins to access system alerts
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get recent system logs that represent alerts
    const alerts = await prisma.systemLog.findMany({
      where: {
        level: {
          in: ['ERROR', 'WARN', 'FATAL']
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50,
      select: {
        id: true,
        level: true,
        message: true,
        category: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Transform logs to alert format
    const formattedAlerts = alerts.map(log => ({
      id: log.id,
      type: log.level === 'ERROR' || log.level === 'FATAL' ? 'error' : 'warning',
      message: log.message,
      timestamp: log.createdAt.toISOString(),
      isRead: false, // This could be enhanced with a read status system
      category: log.category,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : null
    }))

    // Also check for health check failures
    const healthCheckFailures = await prisma.systemHealthCheck.findMany({
      where: {
        status: {
          in: ['warning', 'critical']
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        errorMessage: true,
        lastCheckedAt: true
      }
    })

    const healthAlerts = healthCheckFailures.map(check => ({
      id: `health-${check.id}`,
      type: check.status === 'critical' ? 'error' : 'warning',
      message: `Health check failed: ${check.name}${check.errorMessage ? ` - ${check.errorMessage}` : ''}`,
      timestamp: check.lastCheckedAt?.toISOString() || new Date().toISOString(),
      isRead: false,
      category: 'HEALTH_CHECK'
    }))

    // Combine and sort alerts
    const allAlerts = [...formattedAlerts, ...healthAlerts]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20) // Limit to 20 most recent alerts

    return NextResponse.json(allAlerts)
  } catch (error) {
    logger.error('Error fetching system alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Only allow super admins to create alerts
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { message, type, category } = await request.json()

    if (!message || !type || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: message, type, category' },
        { status: 400 }
      )
    }

    // Create a system log entry for the custom alert
    const alert = await prisma.systemLog.create({
      data: {
        level: type === 'error' ? 'ERROR' : type === 'warning' ? 'WARN' : 'INFO',
        category,
        message,
        source: 'ADMIN_PANEL',
        userId: session.user.id,
        metadata: {
          manuallyCreated: true,
          createdBy: session.user.email
        }
      }
    })

    return NextResponse.json({
      id: alert.id,
      message: 'Alert created successfully'
    })
  } catch (error) {
    logger.error('Error creating alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}