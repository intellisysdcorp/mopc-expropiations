import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { queryMonitor } from '@/lib/query-monitor'

// Only Super Admin and Department Admin can access performance metrics
const allowedRoles = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN']

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to access performance metrics
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') // '1h', '24h', '7d', '30d'
    const detailed = searchParams.get('detailed') === 'true'

    // Calculate time range
    const startDate = new Date()
    const now = new Date()

    switch (timeRange) {
      case '1h':
        startDate.setHours(now.getHours() - 1)
        break
      case '24h':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      default:
        // Default to last 24 hours
        startDate.setDate(now.getDate() - 1)
    }

    const stats = queryMonitor.getStatistics()
    const metricsInRange = queryMonitor.getMetricsByTimeRange(startDate, now)
    const slowQueries = queryMonitor.getSlowQueries()

    const response = {
      success: true,
      data: {
        summary: stats,
        timeRange: {
          start: startDate,
          end: now,
          range: timeRange || '24h'
        },
        slowQueriesCount: slowQueries.length,
        metricsInRange: metricsInRange.length,
        averageResponseTime: metricsInRange.length > 0
          ? metricsInRange.reduce((sum, m) => sum + m.duration, 0) / metricsInRange.length
          : 0,
        slowQueriesInTimeRange: metricsInRange.filter(m => m.duration > 100).length
      }
    }

    // Include detailed information if requested
    if (detailed) {
      response.data = {
        ...response.data,
        slowQueries: slowQueries.slice(0, 20).map(({ query, duration, timestamp, success, error }) => ({
          query,
          duration,
          timestamp,
          success,
          error
        })), // Top 20 slow queries (sanitized)
        recentMetrics: metricsInRange.slice(-50).map(({ query, duration, timestamp, success, error }) => ({
          query,
          duration,
          timestamp,
          success,
          error
        })), // Last 50 queries in time range (sanitized)
        metricsByHour: groupMetricsByHour(metricsInRange)
      } as any
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Error fetching performance metrics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admin can clear metrics
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    queryMonitor.clearMetrics()

    return NextResponse.json({
      success: true,
      message: 'Performance metrics cleared successfully'
    })

  } catch (error) {
    logger.error('Error clearing performance metrics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to group metrics by hour
function groupMetricsByHour(metrics: any[]) {
  const groups: { [key: string]: any[] } = {}

  metrics.forEach(metric => {
    const hour = metric.timestamp.toISOString().substring(0, 13) // YYYY-MM-DDTHH
    if (!groups[hour]) {
      groups[hour] = []
    }
    groups[hour].push(metric)
  })

  return Object.entries(groups).map(([hour, hourMetrics]) => ({
    hour,
    count: hourMetrics.length,
    averageDuration: hourMetrics.reduce((sum, m) => sum + m.duration, 0) / hourMetrics.length,
    slowQueries: hourMetrics.filter(m => m.duration > 100).length,
    successRate: (hourMetrics.filter(m => m.success).length / hourMetrics.length) * 100
  })).sort((a, b) => a.hour.localeCompare(b.hour))
}