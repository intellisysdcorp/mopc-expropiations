'use client';

import { useEffect, useState } from 'react';
import clientLogger from '@/lib/client-logger';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    // Measure Core Web Vitals
    const measurePerformance = (): (() => void) | void => {
      try {
        // First Contentful Paint
        const fcpEntry = performance.getEntriesByName(
          'first-contentful-paint'
        )[0] as PerformanceEntry;
        if (fcpEntry) {
          setMetrics((prev) => ({
            ...prev,
            fcp: Math.round(fcpEntry.startTime),
          }));
        }

        // Time to First Byte
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        if (navigation) {
          setMetrics((prev) => ({
            ...prev,
            ttfb: Math.round(navigation.responseStart),
          }));
        }

        // Largest Contentful Paint (needs observer)
        if ('PerformanceObserver' in window) {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              setMetrics((prev) => ({
                ...prev,
                lcp: Math.round(lastEntry.startTime),
              }));
            }
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Cumulative Layout Shift
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            setMetrics((prev) => ({
              ...prev,
              cls: Math.round(clsValue * 1000) / 1000,
            }));
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // First Input Delay
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const firstEntry = entries[0] as any;
              if (firstEntry) {
                setMetrics((prev) => ({
                  ...prev,
                  fid: Math.round(
                    firstEntry.processingStart - firstEntry.startTime
                  ),
                }));
              }
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });

          return () => {
            lcpObserver.disconnect();
            clsObserver.disconnect();
            fidObserver.disconnect();
          };
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          clientLogger.warn('Error measuring performance:', error);
        }
      }
    };

    // Wait for page to fully load
    if (document.readyState === 'complete') {
      const cleanup = measurePerformance();
      return cleanup;
    } else {
      window.addEventListener('load', measurePerformance);
      return () => window.removeEventListener('load', measurePerformance);
    }
  }, []);

  // Log metrics in development
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      Object.keys(metrics).length > 0
    ) {
      clientLogger.info('🚀 Performance Metrics');
      Object.entries(metrics).forEach(([key, value]) => {
        const formattedValue = typeof value === 'number' ? `${value}ms` : 'N/A';
        clientLogger.info(`${key.toUpperCase()}: ${formattedValue}`);
      });
      clientLogger.info('Performance Metrics End');
    }
  }, [metrics]);

  return null; // This component doesn't render anything visible
}

// Hook for using performance data
export function usePerformanceMetrics() {
  const [metrics, _setMetrics] = useState<Partial<PerformanceMetrics>>({});

  useEffect(() => {
    // Similar logic as above but returns the metrics
    // This can be used by other components to display performance data
  }, []);

  return metrics;
}