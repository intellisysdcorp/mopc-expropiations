'use client';

import { useMemo, ReactNode, Fragment } from 'react';
import { Home, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string | undefined;
  icon?: ReactNode;
  isActive?: boolean;
  isDropdown?: boolean;
  dropdownItems?: BreadcrumbItem[];
}

interface EnhancedBreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: ReactNode;
  maxItems?: number;
  showHome?: boolean;
  className?: string;
}

const HOME_BREADCRUMB = {
  label: 'Inicio',
  href: '/dashboard',
  icon: <Home className="h-4 w-4" />,
}

export function EnhancedBreadcrumbs({
  items: propItems,
  maxItems = 4,
  showHome = true,
  className,
}: EnhancedBreadcrumbsProps) {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname if not provided
  const generateBreadcrumbsFromPath = (): BreadcrumbItem[] => {
    const segments = (pathname || "").split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      const isLast = index === segments.length - 1;

      // Format segment title
      let label = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Handle special cases
      switch (segment) {
        case 'dashboard':
          label = 'Panel Principal';
          break;
        case 'cases':
          label = 'Casos';
          break;
        case 'users':
          label = 'Usuarios';
          break;
        case 'departments':
          label = 'Departamentos';
          break;
        case 'reports':
          label = 'Reportes';
          break;
        case 'settings':
          label = 'Configuración';
          break;
        case 'create':
          label = 'Crear';
          break;
        case 'edit':
          label = 'Editar';
          break;
        case 'admin':
          label = 'Administración';
          break;
        default:
          // Keep original formatting for IDs and special terms
          if (/^[a-f0-9-]{36}$/i.test(segment)) {
            label = `Caso ${segment.slice(0, 8)}...`;
          }
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : href,
        isActive: isLast,
      });
    });

    return breadcrumbs;
  };

  const items = propItems || generateBreadcrumbsFromPath();

  // Handle overflow with memoized allItems
  const displayItems = useMemo(() => {
    // Add home breadcrumb inside useMemo to prevent recreation on every render
    const allItems = showHome
      ? [
          HOME_BREADCRUMB,
          ...items,
        ]
      : items;

    if (allItems.length <= maxItems) {
      return allItems;
    }

    const firstItems = allItems.slice(0, 2);
    const lastItems = allItems.slice(-2);

    return [
      ...firstItems,
      {
        label: '',
        isDropdown: true,
        dropdownItems: allItems.slice(2, -2),
      },
      ...lastItems,
    ];
  }, [items, showHome, maxItems]);

  return (
    <nav
      aria-label="Navegación de migajas de pan"
      className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}
    >
      <ol className="flex items-center space-x-1">
        {displayItems.map((item: BreadcrumbItem, index) => {
          const isLast = index === displayItems.length - 1;
          if (item.isDropdown && item.dropdownItems) {
            return (
              <Fragment key={`dropdown-${index}`}>
                <BreadcrumbSeparator />
                <li className="flex items-center">
                  <div className="group relative">
                    <button
                      className="flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      aria-label="Más elementos de navegación"
                      aria-haspopup="true"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10">
                      <div className="bg-popover border rounded-md shadow-lg p-1 min-w-[200px]">
                        {item.dropdownItems.map((dropdownItem, dropdownIndex) => (
                          <Link
                            key={dropdownIndex}
                            href={dropdownItem.href || '#'}
                            className={cn(
                              'flex items-center space-x-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                              !dropdownItem.href && 'text-muted-foreground cursor-not-allowed'
                            )}
                          >
                            {dropdownItem.icon}
                            <span>{dropdownItem.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          }

          return (
            <Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <li className="flex items-center">
                {item.href && !item.isActive ? (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'flex items-center space-x-1 px-2 py-1',
                      item.isActive && 'text-foreground font-medium'
                    )}
                    aria-current={item.isActive ? 'page' : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbSeparator({ children }: { children?: ReactNode }) {
  return (
    <li className="flex items-center text-muted-foreground/50" aria-hidden="true">
      {children}
    </li>
  );
}

// Hook for programmatic navigation
export function useBreadcrumbs() {
  const pathname = usePathname();

  const generateBreadcrumbs = (customItems?: BreadcrumbItem[]) => {
    if (customItems) {
      return customItems;
    }

    const segments = (pathname || '').split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      HOME_BREADCRUMB
    ];

    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      const isLast = index === segments.length - 1;

      let label = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Format special segments
      switch (segment) {
        case 'dashboard':
          label = 'Panel Principal';
          break;
        case 'cases':
          label = 'Casos';
          break;
        case 'users':
          label = 'Usuarios';
          break;
        case 'departments':
          label = 'Departamentos';
          break;
        case 'reports':
          label = 'Reportes';
          break;
        case 'settings':
          label = 'Configuración';
          break;
        case 'create':
          label = 'Crear';
          break;
        case 'edit':
          label = 'Editar';
          break;
        case 'admin':
          label = 'Administración';
          break;
        default:
          if (/^[a-f0-9-]{36}$/i.test(segment)) {
            label = `Caso ${segment.slice(0, 8)}...`;
          }
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : href,
        isActive: isLast,
      });
    });

    return breadcrumbs;
  };

  return { generateBreadcrumbs };
}