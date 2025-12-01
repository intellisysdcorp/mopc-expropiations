'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

type ReactNode = React.ReactNode;

// Interactive button with enhanced feedback
export function InteractiveButton({
  children,
  className,
  variant = 'default',
  size = 'default',
  disabled,
  loading,
  ...props
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [isPressed, setIsPressed] = useState(false);

  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-sm hover:shadow-md',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 shadow-sm hover:shadow-md',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
  };

  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
        'ring-offset-background transition-all duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'transform active:scale-95',
        variantClasses[variant],
        sizeClasses[size],
        isPressed && 'scale-95',
        loading && 'cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
      )}
      {children}
    </button>
  );
}

// Card with hover effects
export function InteractiveCard({
  children,
  className,
  hover = true,
  clickable = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        'transition-all duration-300 ease-in-out',
        hover && 'hover:shadow-lg hover:-translate-y-1 hover:border-primary/20',
        clickable && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Animated badge
export function AnimatedBadge({
  children,
  className,
  variant = 'default',
  pulse = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  pulse?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const variantClasses = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        'transition-all duration-200 ease-in-out',
        'hover:scale-105 active:scale-95',
        variantClasses[variant],
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Smooth number animation
export function AnimatedNumber({
  value,
  duration = 1000,
  className,
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

// Fade in component
export function FadeIn({
  children,
  delay = 0,
  duration = 500,
  className,
  as: Component = 'div',
  ...props
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Component
      className={cn(
        'animate-in fade-in',
        'duration-' + duration,
        'delay-' + delay,
        className
      )}
      style={{
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Slide in component
export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 300,
  className,
  as: Component = 'div',
  ...props
}: {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const directionClasses = {
    up: 'slide-in-from-bottom',
    down: 'slide-in-from-top',
    left: 'slide-in-from-right',
    right: 'slide-in-from-left',
  };

  return (
    <Component
      className={cn(
        'animate-in',
        directionClasses[direction],
        className
      )}
      style={{
        animationDuration: `${duration}ms`,
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Staggered list animation
export function StaggeredList({
  children,
  staggerDelay = 100,
  className,
  ...props
}: {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {React.Children.map(children, (child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// Pulse on hover component
export function PulseOnHover({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Gradient shift animation
export function GradientShift({
  children,
  className,
  from = 'from-blue-500',
  via = 'via-purple-500',
  to = 'to-pink-500',
  ...props
}: {
  children: ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r',
        from,
        via,
        to,
        'animate-gradient-x',
        'bg-[length:200%_200%]',
        className
      )}
      style={{
        animation: 'gradient 3s ease infinite',
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// Shimmer effect
export function Shimmer({
  className,
  ...props
}: {
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        'before:absolute before:inset-0 before:bg-gradient-to-r',
        'before:from-transparent before:via-white/20 before:to-transparent',
        'before:animate-shimmer',
        className
      )}
      style={{
        animation: 'shimmer 2s infinite',
      }}
      {...props}
    />
  );
}

// Bounce animation
export function Bounce({
  children,
  trigger = 'hover',
  className,
  ...props
}: {
  children: ReactNode;
  trigger?: 'hover' | 'always' | 'never';
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [isBouncing, setIsBouncing] = useState(trigger === 'always');

  const handleInteraction = () => {
    if (trigger === 'hover') {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 500);
    }
  };

  return (
    <div
      className={cn(
        'transition-transform duration-200',
        isBouncing && 'animate-bounce',
        trigger === 'hover' && 'hover:animate-bounce',
        className
      )}
      onMouseEnter={handleInteraction}
      {...props}
    >
      {children}
    </div>
  );
}

// Typewriter effect
export function Typewriter({
  text,
  speed = 50,
  delay = 0,
  className,
  onComplete,
}: {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, [text, speed, delay, onComplete]);

  return (
    <span className={cn('font-mono', className)}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

// Floating animation
export function Floating({
  children,
  amplitude = 10,
  duration = 3,
  className,
  ...props
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-float', className)}
      style={{
        animation: `float ${duration}s ease-in-out infinite`,
        '--float-amplitude': `${amplitude}px`,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}

// Add CSS animations to globals
export const MicroInteractionStyles = () => (
  <style jsx>{`
    @keyframes gradient {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(var(--float-amplitude)); }
    }

    .animate-gradient-x {
      animation: gradient 3s ease infinite;
    }

    .animate-shimmer {
      animation: shimmer 2s infinite;
    }

    .animate-float {
      animation: float var(--duration, 3s) ease-in-out infinite;
    }
  `}</style>
);