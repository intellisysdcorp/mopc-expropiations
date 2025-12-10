'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

// Resource optimization utilities
export const resourceOptimizer = {
  // Lazy load images
  lazyLoadImage: (imgElement: HTMLImageElement, src: string, placeholder?: string) => {
    if (placeholder) {
      imgElement.src = placeholder;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = src;
            img.classList.remove('lazy-loading');
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
      }
    );

    imgElement.classList.add('lazy-loading');
    observer.observe(imgElement);
  },

  // Optimize image loading
  optimizeImage: (src: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  } = {}) => {
    const { width, height, quality = 80, format = 'webp' } = options;

    // This would integrate with your image optimization service
    let optimizedSrc = src;

    if (width || height) {
      optimizedSrc += `?w=${width || 'auto'}&h=${height || 'auto'}`;
    }

    optimizedSrc += `&q=${quality}&f=${format}`;

    return optimizedSrc;
  },

  // Preload critical resources
  preloadResource: (href: string, as: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      document.head.appendChild(link);
    }
  },

  // Prefetch resources
  prefetchResource: (href: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    }
  },
};

// Bundle size optimization utilities
export const bundleOptimizer = {
  // Dynamic imports
  lazyLoad: <T extends React.ComponentType<any>>(importFunction: () => Promise<{ default: T }>) => {
    return React.lazy(importFunction);
  },

  // Code splitting based on user interaction
  splitOnInteraction: (callback: () => void, threshold: number = 1000) => {
    let timeout: NodeJS.Timeout;

    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(callback, threshold);
    };
  },

  // Tree shaking helper
  onlyExported: <T extends any>(module: T) => {
    return module;
  },
};

// Memory management utilities
export const memoryManager = {
  // Clean up event listeners
  cleanupListeners: (element: Element, events: string[]) => {
    events.forEach(event => {
      element.removeEventListener(event, () => {});
    });
  },

  // Clear intervals and timeouts
  clearTimers: (timers: (NodeJS.Timeout | number)[]) => {
    timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
  },

  // Monitor memory usage
  getMemoryUsage: () => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  },

  // Force garbage collection (in development)
  forceGC: () => {
    if (process.env.NODE_ENV === 'development' && 'gc' in window) {
      (window as any).gc();
    }
  },
};

// Network optimization utilities
export const networkOptimizer = {
  // Request caching
  cache: new Map<string, { data: any; timestamp: number; ttl: number }>(),

  async cachedFetch<T extends any = any>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: Date.now(), ttl });
      return data;
    } catch (error) {
      if (cached) {
        return cached.data; // Return stale cache on error
      }
      throw error;
    }
  },

  // Request batching
  batchRequests: <T extends any = any>(requests: Array<() => Promise<T>>, batchSize: number = 5) => {
    const results: Promise<T>[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      results.push(
        Promise.all(batch.map(req => req()))
          .then(results => results[0] as T) // Return first result for now
      );
    }

    return results;
  },

  // Request deduplication
  dedupeRequests: new Map<string, Promise<any>>(),

  async dedupedFetch<T extends any = any>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.dedupeRequests.has(key)) {
      return this.dedupeRequests.get(key);
    }

    const promise = fetcher().finally(() => {
      this.dedupeRequests.delete(key);
    });

    this.dedupeRequests.set(key, promise);
    return promise;
  },

  // Retry mechanism with exponential backoff
  async retry<T extends any = any>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
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

// Hook for lazy loading with loading states
export const useLazyLoad = <T extends any>(
  loader: () => Promise<T>,
  options: {
    threshold?: number;
    rootMargin?: string;
    retryCount?: number;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { threshold = 0.1, rootMargin = '50px', retryCount = 3 } = options;
  const elementRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);

  const loadData = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await loader();
      setData(result);
      retryCountRef.current = 0;
    } catch (err) {
      if (retryCountRef.current < retryCount) {
        retryCountRef.current++;
        setTimeout(loadData, 1000 * retryCountRef.current);
      } else {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  }, [loader, loading, retryCount]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadData();
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loadData, threshold, rootMargin]);

  return { elementRef, data, loading, error, retry: loadData };
};

// Hook for debounced values
export const useDebounce = <T extends any>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Hook for throttled functions
export const useThrottle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        fn(...args);
        lastRun.current = Date.now();
      }
    },
    [fn, delay]
  ) as T;
};

// Hook for virtual scrolling (for large lists)
export const useVirtualScroll = (
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEnd = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(visibleStart, visibleEnd + 1).map((item, index) => ({
    item,
    index: visibleStart + index,
  }));

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
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