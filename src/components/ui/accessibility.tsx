'use client';

import {
  ButtonHTMLAttributes,
  cloneElement,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

// Skip link component for keyboard navigation
export function SkipLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50',
        'bg-primary text-primary-foreground px-4 py-2 rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {children}
    </a>
  );
}

// Focus trap component for modals and dialogs
export function FocusTrap({
  children,
  isActive,
  onEscape,
}: {
  children: ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Find first focusable element
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    // Handle tab key
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);

      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, onEscape]);

  return <div ref={containerRef}>{children}</div>;
}

// Live region for announcements
export function LiveRegion({
  politeness = 'polite',
  children,
}: {
  politeness?: 'polite' | 'assertive' | 'off';
  children: ReactNode;
}) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}

// Screen reader only text
export function ScreenReaderOnly({
  children,
}: {
  children: ReactNode;
}) {
  return <span className="sr-only">{children}</span>;
}

// Accessible button with loading state
export function AccessibleButton({
  children,
  loading,
  loadingText = 'Cargando...',
  disabled,
  className,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-describedby={loading ? 'loading-description' : undefined}
      {...props}
    >
      {loading && (
        <div
          className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
          aria-hidden="true"
        />
      )}
      {loading ? loadingText : children}
      {loading && (
        <span id="loading-description" className="sr-only">
          La acción está siendo procesada
        </span>
      )}
    </button>
  );
}

// Accessible form field with proper labeling
export function AccessibleField({
  label,
  error,
  description,
  required,
  children,
}: {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const descriptionId = `${fieldId}-description`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive" aria-label="requerido">
            *
          </span>
        )}
      </label>
      {cloneElement(children as ReactElement<any>, {
        id: fieldId,
        'aria-describedby': [
          description && descriptionId,
          error && errorId,
        ].filter(Boolean).join(' '),
        'aria-invalid': error ? 'true' : 'false',
        'aria-required': required,
      })}
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Accessible progress bar
export function AccessibleProgress({
  value,
  max = 100,
  label,
  showValue = true,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
  className?: string;
}) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        {showValue && (
          <span aria-label={`Progreso: ${percentage} por ciento`}>
            {percentage}%
          </span>
        )}
      </div>
      <div
        className="w-full bg-secondary rounded-full h-2"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${percentage} por ciento completado`}
      >
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Accessible tabs component
export function AccessibleTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  tabs: Array<{
    id: string;
    label: string;
    content: ReactNode;
    icon?: ReactNode;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: any, index: number) => {
    let newIndex = index;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = index > 0 ? index - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = index < tabs.length - 1 ? index + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        const tab = tabs[index];
        if (tab) {
          onTabChange(tab.id);
        }
        return;
      default:
        return;
    }

    const tabButtons = tabsRef.current?.querySelectorAll('[role="tab"]');
    (tabButtons?.[newIndex] as HTMLElement)?.focus();
  };

  return (
    <div className={cn('w-full', className)}>
      <div ref={tabsRef} role="tablist" aria-label="Navegación de pestañas">
        <div className="flex space-x-1 border-b">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          tabIndex={0}
          className={cn('mt-4', activeTab !== tab.id && 'hidden')}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

// Accessible modal/dialog
export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus management
    const modal = modalRef.current;
    if (modal) {
      modal.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <FocusTrap isActive={isOpen} onEscape={onClose}>
        <div
          ref={modalRef}
          className={cn(
            'relative bg-background border rounded-lg shadow-lg p-6 max-w-lg w-full mx-4',
            'focus:outline-none',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Cerrar diálogo"
            >
              <span className="sr-only">Cerrar</span>
              ×
            </button>
          </div>

          <div>{children}</div>
        </div>
      </FocusTrap>
    </div>
  );
}

// Accessible table component
export function AccessibleTable({
  headers,
  rows,
  caption,
  className,
}: {
  headers: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    sortDirection?: 'asc' | 'desc';
    onSort?: () => void;
  }>;
  rows: Array<Record<string, ReactNode>>;
  caption?: string;
  className?: string;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)}>
        {caption && (
          <caption className="mt-4 text-sm text-muted-foreground">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="border-b">
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className={cn(
                  'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
                  header.sortable && 'cursor-pointer hover:text-foreground',
                  '[&:has([role=checkbox])]:pr-0'
                )}
                onClick={header.sortable ? header.onSort : undefined}
                aria-sort={
                  header.sortDirection
                    ? header.sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <div className="flex items-center space-x-2">
                  <span>{header.label}</span>
                  {header.sortDirection && (
                    <span aria-hidden="true">
                      {header.sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={cn(
                'border-b transition-colors hover:bg-muted/50',
                '[&:last-child]:border-0'
              )}
            >
              {headers.map((header) => (
                <td
                  key={header.key}
                  className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
                >
                  {row[header.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Accessibility announcement hook
export function useAnnouncement() {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string) => {
    setAnnouncement(message);

    // Clear announcement after it's read
    setTimeout(() => {
      setAnnouncement('');
    }, 1000);
  }, []);

  const AnnouncementComponent = () => (
    <LiveRegion politeness="polite">
      {announcement}
    </LiveRegion>
  );

  return { announce, AnnouncementComponent };
}

// Color contrast checker
export const colorContrast = {
  calculateRatio: (foreground: string, background: string): number => {
    // Simple luminance calculation
    const getLuminance = (hex: string): number => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;

      const processedValues = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      const rs = processedValues[0] ?? 0;
      const gs = processedValues[1] ?? 0;
      const bs = processedValues[2] ?? 0;

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  },

  meetsWCAG: (ratio: number, level: 'AA' | 'AAA' = 'AA', size: 'normal' | 'large' = 'normal'): boolean => {
    const thresholds = {
      AA: { normal: 4.5, large: 3.0 },
      AAA: { normal: 7.0, large: 4.5 },
    };

    return ratio >= thresholds[level][size];
  },
};

// Keyboard navigation helper
export const keyboardNavigation = {
  isKeyboardUser: (): boolean => {
    return typeof window !== 'undefined' &&
           (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
            !window.matchMedia('(hover: hover)').matches);
  },

  focusVisible: {
    enable: () => {
      if (typeof document === 'undefined') return;

      let hadKeyboardEvent = false;

      const handleKeyDown = () => {
        hadKeyboardEvent = true;
      };

      const handleMouseDown = () => {
        hadKeyboardEvent = false;
      };

      const handleFocus = (e: FocusEvent) => {
        if (hadKeyboardEvent) {
          (e.target as HTMLElement).classList.add('focus-visible');
        }
      };

      const handleBlur = (e: FocusEvent) => {
        (e.target as HTMLElement).classList.remove('focus-visible');
      };

      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('mousedown', handleMouseDown, true);
      document.addEventListener('focus', handleFocus, true);
      document.addEventListener('blur', handleBlur, true);

      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('mousedown', handleMouseDown, true);
        document.removeEventListener('focus', handleFocus, true);
        document.removeEventListener('blur', handleBlur, true);
      };
    },
  },
};