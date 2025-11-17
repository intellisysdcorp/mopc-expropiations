'use client'
import clientLogger from '@/lib/client-logger';

// Performance monitoring utilities
interface PerformanceMetrics {
  pageLoad: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  firstInputDelay: number
  cumulativeLayoutShift: number
  memoryUsage?: number
}

interface PerformanceEntry {
  name: string
  startTime: number
  duration: number
  timestamp: number
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {}
  private entries: PerformanceEntry[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initializeObservers()
    this.collectInitialMetrics()
  }

  private initializeObservers() {
    if (typeof window === 'undefined') return

    // Observe navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.metrics.pageLoad = navEntry.loadEventEnd - navEntry.loadEventStart
            this.logMetric('pageLoad', this.metrics.pageLoad)
          }
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navObserver)
    } catch (error) {
      clientLogger.warn('Navigation timing not supported:', error)
    }

    // Observe paint timing
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime
            this.logMetric('firstContentfulPaint', this.metrics.firstContentfulPaint)
          }
        }
      })
      paintObserver.observe({ entryTypes: ['paint'] })
      this.observers.push(paintObserver)
    } catch (error) {
      clientLogger.warn('Paint timing not supported:', error)
    }

    // Observe largest contentful paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.metrics.largestContentfulPaint = lastEntry?.startTime || 0
        this.logMetric('largestContentfulPaint', this.metrics.largestContentfulPaint)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(lcpObserver)
    } catch (error) {
      clientLogger.warn('LCP not supported:', error)
    }

    // Observe layout shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue
        this.logMetric('cumulativeLayoutShift', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(clsObserver)
    } catch (error) {
      clientLogger.warn('CLS not supported:', error)
    }

    // Observe long tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.logEntry({
            name: 'long-task',
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now()
          })
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.push(longTaskObserver)
    } catch (error) {
      clientLogger.warn('Long task observer not supported:', error)
    }
  }

  private collectInitialMetrics() {
    if (typeof window === 'undefined') return

    // Collect memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024 // MB
    }

    // Collect navigation timing from performance.navigation
    if (performance.timing) {
      const timing = performance.timing
      const pageLoad = timing.loadEventEnd - timing.navigationStart
      if (pageLoad > 0) {
        this.metrics.pageLoad = pageLoad
        this.logMetric('pageLoadFromTiming', pageLoad)
      }
    }
  }

  private logMetric(name: string, value: number) {
    if (process.env.NODE_ENV === 'development') {
      clientLogger.info(`[Performance] ${name}:`, value)
    }

    // Send to analytics service in production
    if (process.env.NODE_ENV === 'production' && 'gtag' in window) {
      ;(window as any).gtag('event', 'performance_metric', {
        metric_name: name,
        metric_value: value,
        custom_parameter_1: window.location.pathname
      })
    }
  }

  private logEntry(entry: PerformanceEntry) {
    this.entries.push(entry)

    if (process.env.NODE_ENV === 'development') {
      clientLogger.info(`[Performance Entry] ${entry.name}:`, entry.duration, 'ms')
    }
  }

  // Public API methods
  public mark(name: string) {
    if (typeof window !== 'undefined' && 'mark' in performance) {
      performance.mark(name)
    }
  }

  public measure(name: string, startMark?: string, endMark?: string) {
    if (typeof window !== 'undefined' && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark)
        const measure = performance.getEntriesByName(name, 'measure')[0]
        if (measure) {
          this.logEntry({
            name,
            startTime: measure.startTime,
            duration: measure.duration,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        clientLogger.warn('Failed to create measure:', error)
      }
    }
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics }
  }

  public getEntries(): PerformanceEntry[] {
    return [...this.entries]
  }

  public getReport() {
    return {
      metrics: this.metrics,
      entries: this.entries.slice(-10), // Last 10 entries
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      timestamp: Date.now()
    }
  }

  // Method to measure component render time
  public measureComponentRender(componentName: string) {
    const startMark = `${componentName}-render-start`
    const endMark = `${componentName}-render-end`

    return {
      start: () => this.mark(startMark),
      end: () => this.measure(`${componentName}-render`, startMark, endMark)
    }
  }

  // Method to measure API call performance
  public async measureApiCall<T>(
    apiCall: () => Promise<T>,
    apiName: string
  ): Promise<T> {
    const startMark = `${apiName}-start`
    const endMark = `${apiName}-end`

    this.mark(startMark)

    try {
      const result = await apiCall()
      this.mark(endMark)
      this.measure(`${apiName}-duration`, startMark, endMark)
      return result
    } catch (error) {
      this.mark(endMark)
      this.measure(`${apiName}-duration`, startMark, endMark)
      this.logEntry({
        name: `${apiName}-error`,
        startTime: 0,
        duration: 0,
        timestamp: Date.now()
      })
      throw error
    }
  }

  public cleanup() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const measureComponent = (componentName: string) => {
    return performanceMonitor.measureComponentRender(componentName)
  }

  const measureApiCall = async <T>(
    apiCall: () => Promise<T>,
    apiName: string
  ): Promise<T> => {
    return performanceMonitor.measureApiCall(apiCall, apiName)
  }

  const getMetrics = () => performanceMonitor.getMetrics()

  const getReport = () => performanceMonitor.getReport()

  return {
    measureComponent,
    measureApiCall,
    getMetrics,
    getReport
  }
}

// Utility function for measuring page load performance
export function measurePageLoad() {
  if (typeof window === 'undefined') return

  window.addEventListener('load', () => {
    setTimeout(() => {
      const report = performanceMonitor.getReport()
      clientLogger.info('Page Load Performance Report:', report)
    }, 0)
  })
}