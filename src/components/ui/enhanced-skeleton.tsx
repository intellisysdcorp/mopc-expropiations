import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'text' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

export function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  lines,
  animate = true,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className={cn('space-y-1', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 bg-muted rounded',
              animate && 'animate-pulse',
              i === lines - 1 ? 'w-3/4' : 'w-full'
            )}
            style={{
              width: i === lines - 1 ? '75%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-muted',
        variantClasses[variant],
        animate && 'animate-pulse',
        className
      )}
      style={{
        width,
        height,
      }}
      {...props}
    />
  );
}

// Card skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="space-y-4">
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" lines={2} />
        <div className="flex items-center justify-between">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="rectangular" width={80} height={24} />
        </div>
      </div>
    </div>
  );
}

// Table skeleton
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <div className="border-b">
        <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={16} />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} height={16} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// List skeleton
export function ListSkeleton({
  items = 5,
  showAvatar = true,
  className,
}: {
  items?: number;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={14} />
          </div>
          <Skeleton variant="rectangular" width={60} height={24} />
        </div>
      ))}
    </div>
  );
}

// Form skeleton
export function FormSkeleton({
  fields = 4,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" width="30%" height={14} />
          <Skeleton variant="rectangular" height={40} />
        </div>
      ))}
      <div className="flex justify-end space-x-2 pt-4">
        <Skeleton variant="rectangular" width={80} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </div>
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 border rounded-lg', className)}>
      <div className="space-y-4">
        <Skeleton variant="text" width="40%" height={20} />
        <div className="h-64 flex items-end justify-around">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={40}
              height={50 + (i*20) % 150}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Calendar skeleton
export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('border rounded-lg', className)}>
      <div className="p-4 border-b">
        <Skeleton variant="text" width="30%" height={20} />
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-background p-2 min-h-[80px]">
            <Skeleton variant="text" width="20px" height={16} />
            <div className="mt-1 space-y-1">
              <Skeleton variant="rectangular" width="100%" height={12} />
              {(i % 3 === 0 || i % 5 === 1) && (
                <Skeleton variant="rectangular" width="80%" height={12} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Search results skeleton
export function SearchResultsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start space-x-3 p-3 border rounded-lg">
          <Skeleton variant="circular" width={20} height={20} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="70%" height={16} />
            <Skeleton variant="text" width="90%" height={14} />
            <div className="flex items-center space-x-2">
              <Skeleton variant="rectangular" width={60} height={16} />
              <Skeleton variant="rectangular" width={80} height={16} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Page skeleton
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6 animate-pulse', className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="text" width="30%" height={32} />
        <Skeleton variant="text" width="50%" height={16} />
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton />
          <TableSkeleton rows={3} columns={4} />
        </div>
        <div className="space-y-6">
          <CardSkeleton />
          <ListSkeleton items={3} />
        </div>
      </div>
    </div>
  );
}

// Loading overlay
export function LoadingOverlay({
  isLoading,
  children,
  message = 'Cargando...',
  className,
}: {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center space-y-4 p-6 bg-card border rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Progress loader
export function ProgressLoader({
  progress,
  message,
  className,
}: {
  progress: number;
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {message && (
        <p className="text-sm text-muted-foreground text-center">{message}</p>
      )}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
    </div>
  );
}

// Empty state with loading
export function EmptyStateWithLoading({
  isLoading,
  empty,
  children,
  className,
}: {
  isLoading: boolean;
  empty: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (isLoading) {
    return className ? <PageSkeleton className={className} /> : <PageSkeleton />;
  }

  if (empty) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <div className="w-8 h-8 bg-muted-foreground/20 rounded"></div>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No hay datos disponibles</h3>
        <p className="text-muted-foreground max-w-sm">
          No se encontraron elementos para mostrar. Intenta ajustar los filtros o crear nuevos elementos.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}