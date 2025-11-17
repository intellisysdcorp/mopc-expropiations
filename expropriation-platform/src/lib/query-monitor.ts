import { logger } from '@/lib/logger';
import { performance } from 'perf_hooks'

interface QueryMetrics {
  query: string
  duration: number
  timestamp: Date
  params?: any
  success: boolean
  error?: string
}

class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = []
  private maxMetrics: number = 1000
  private slowQueryThreshold: number = 100 // ms

  constructor(maxMetrics = 1000, slowQueryThreshold = 100) {
    this.maxMetrics = maxMetrics
    this.slowQueryThreshold = slowQueryThreshold
  }

  // Track query performance
  async trackQuery<T>(
    queryType: string,
    queryFn: () => Promise<T>,
    params?: any
  ): Promise<T> {
    const startTime = performance.now()
    const timestamp = new Date()

    try {
      const result = await queryFn()
      const duration = performance.now() - startTime

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn(`🐌 Slow Query Detected (${duration.toFixed(2)}ms): ${queryType}`, {
          duration,
          params: this.sanitizeParams(params)
        })
      }

      // Store metrics
      this.addMetric({
        query: queryType,
        duration,
        timestamp,
        params: this.sanitizeParams(params),
        success: true
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      logger.error(`❌ Query Failed (${duration.toFixed(2)}ms): ${queryType}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        params: this.sanitizeParams(params)
      })

      this.addMetric({
        query: queryType,
        duration,
        timestamp,
        params: this.sanitizeParams(params),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  // Add metric to storage
  private addMetric(metric: QueryMetrics): void {
    this.metrics.push(metric)

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  // Get performance statistics
  getStatistics() {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: 0,
        successRate: 0,
        errorRate: 0
      }
    }

    const successfulQueries = this.metrics.filter(m => m.success)
    const slowQueries = this.metrics.filter(m => m.duration > this.slowQueryThreshold)
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0)

    return {
      totalQueries: this.metrics.length,
      averageDuration: totalDuration / this.metrics.length,
      slowQueries: slowQueries.length,
      successRate: (successfulQueries.length / this.metrics.length) * 100,
      errorRate: ((this.metrics.length - successfulQueries.length) / this.metrics.length) * 100,
      slowestQueries: this.metrics
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(({ query, duration, timestamp }) => ({ query, duration, timestamp })),
      recentMetrics: this.metrics.slice(-50) // Last 50 queries
    }
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = []
  }

  // Get metrics for a specific time range
  getMetricsByTimeRange(startDate: Date, endDate: Date): QueryMetrics[] {
    return this.metrics.filter(
      metric => metric.timestamp >= startDate && metric.timestamp <= endDate
    )
  }

  // Get slow queries
  getSlowQueries(threshold?: number): QueryMetrics[] {
    const timeThreshold = threshold || this.slowQueryThreshold
    return this.metrics.filter(m => m.duration > timeThreshold)
  }

  // Sanitize parameters to prevent logging sensitive data
  private sanitizeParams(params?: any): any {
    if (!params) return undefined

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'hash']
    const sanitized: any = {}

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...'
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }
}

// Singleton instance for global usage
export const queryMonitor = new QueryPerformanceMonitor()

// Decorator for automatic query tracking
export function trackQuery(queryType?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const queryName = queryType || `${target.constructor.name}.${propertyName}`
      return queryMonitor.trackQuery(queryName, () => method.apply(this, args), args)
    }

    return descriptor
  }
}

export default queryMonitor