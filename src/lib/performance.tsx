'use client';

import { useEffect, useState } from 'react';
import clientLogger from '@/lib/client-logger';

// Performance monitoring utilities
export const performanceMonitor = {
  // Measure page load performance
  measurePageLoad: () => {
    if (typeof window === 'undefined') return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      // Core Web Vitals
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime || 0,
      firstInputDelay: (performance.getEntriesByName('first-input')[0] as any)?.processingStart || 0,
      cumulativeLayoutShift: performanceMonitor.getCLS(),

      // Navigation timing
      domContentLoaded: (navigation?.domContentLoadedEventEnd || 0) - (navigation?.domContentLoadedEventStart || 0),
      loadComplete: (navigation?.loadEventEnd || 0) - (navigation?.loadEventStart || 0),
      timeToInteractive: performanceMonitor.getTTI(),

      // Network timing
      dnsLookup: (navigation?.domainLookupEnd || 0) - (navigation?.domainLookupStart || 0),
      tcpConnect: (navigation?.connectEnd || 0) - (navigation?.connectStart || 0),
      serverResponse: (navigation?.responseEnd || 0) - (navigation?.requestStart || 0),

      // Resource timing
      totalResources: performance.getEntriesByType('resource').length,
      totalSize: performanceMonitor.calculateTotalSize(),
    };
  },

  // Calculate Cumulative Layout Shift
  getCLS: (): number => {
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value || 0;
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });
    return clsValue;
  },

  // Estimate Time to Interactive
  getTTI: (): number => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation.domInteractive - (navigation as any).navigationStart;
  },

  // Calculate total resource size
  calculateTotalSize: (): number => {
    const resources = performance.getEntriesByType('resource');
    return resources.reduce((total, resource) => {
      return total + ((resource as PerformanceResourceTiming).transferSize || 0);
    }, 0);
  },

  // Monitor custom performance metrics
  mark: (name: string) => {
    if (typeof window !== 'undefined') {
      performance.mark(name);
    }
  },

  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof window !== 'undefined') {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      return measure?.duration || 0;
    }
    return 0;
  },

  // Log performance data
  logPerformance: (data: any) => {
    if (process.env.NODE_ENV === 'development') {
      clientLogger.info('Performance Metrics:', data);
    }

    // Send to analytics service in production
    if (process.env.NODE_ENV === 'production') {
      // analytics.track('performance', data);
    }
  },
};

// React hooks for performance optimization
export const usePerformanceOptimizations = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const measurePerformance = () => {
      const data = performanceMonitor.measurePageLoad();
      setMetrics(data);
      performanceMonitor.logPerformance(data);
    };

    // Measure after page loads
    if (document.readyState === 'complete') {
      measurePerformance();
    } else {
      window.addEventListener('load', measurePerformance);
      return () => window.removeEventListener('load', measurePerformance);
    }
    return undefined;
  }, []);

  return { metrics };
};

// Performance monitoring component
export const PerformanceMonitor = () => {
  const { metrics } = usePerformanceOptimizations();

  if (process.env.NODE_ENV !== 'development' || !metrics) {
    return null;
  }

  return (
    <div
      className="bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
      }}
    >
      <div className="space-y-1">
        <div>FCP: {Math.round(metrics.firstContentfulPaint)}ms</div>
        <div>LCP: {Math.round(metrics.largestContentfulPaint)}ms</div>
        <div>FID: {Math.round(metrics.firstInputDelay)}ms</div>
        <div>CLS: {metrics.cumulativeLayoutShift.toFixed(3)}</div>
        <div>TTI: {Math.round(metrics.timeToInteractive)}ms</div>
        <div>Resources: {metrics.totalResources}</div>
        <div>Size: {(metrics.totalSize / 1024 / 1024).toFixed(2)}MB</div>
      </div>
    </div>
  );
};