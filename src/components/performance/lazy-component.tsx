'use client';

import { Suspense, lazy, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyComponentProps {
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  [key: string]: any;
}

export function LazyComponent({
  loader,
  fallback = <ComponentSkeleton />,
  ...props
}: LazyComponentProps) {
  const LazyLoadedComponent = lazy(loader);

  return (
    <Suspense fallback={fallback}>
      <LazyLoadedComponent {...props} />
    </Suspense>
  );
}

function ComponentSkeleton() {
  return (
    <div className="w-full p-4 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// HOC for making any component lazy
export function withLazyLoading<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  return function LazyWrapper(props: P) {
    return <LazyComponent loader={loader} fallback={fallback} {...props} />;
  };
}