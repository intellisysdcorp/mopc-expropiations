'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { navigationItems, NavItem } from './navigation-items';
import { useAuth } from '@/hooks/use-auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarNavigationProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function SidebarNavigation({
  className,
  isCollapsed = false,
  onToggle,
}: SidebarNavigationProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const {
    isAnalyst,
    isDepartmentAdmin,
    isSuperAdmin,
    isSupervisor,
    signOut,
    user,
  } = useAuth();

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const hasPermission = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;

    return roles.some((role) => {
      switch (role) {
        case 'super_admin':
          return isSuperAdmin;
        case 'department_admin':
          return isDepartmentAdmin;
        case 'analyst':
          return isAnalyst;
        case 'supervisor':
          return isSupervisor;
        default:
          return false;
      }
    });
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') {
      return pathname === href || pathname === '/';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    if (!hasPermission(item.roles)) return null;

    const isExpanded = expandedItems.includes(item.title);
    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;

    const buttonContent = (
      <Button
        variant={active ? 'secondary' : 'ghost'}
        className={cn(
          'w-full justify-start text-left h-auto py-2',
          isCollapsed && level === 0 ? 'px-2 justify-center' : 'px-3',
          active && 'bg-secondary font-medium',
          'hover:bg-accent hover:text-accent-foreground transition-colors duration-200'
        )}
        onClick={() => {
          if (hasChildren) {
            toggleExpanded(item.title);
          } else if (item.href) {
            window.location.href = item.href;
          }
        }}
      >
        <item.icon
          className={cn(
            'h-4 w-4 flex-shrink-0',
            isCollapsed && level === 0 ? 'mr-0' : 'mr-3'
          )}
        />
        {!isCollapsed || level > 0 ? (
          <>
            <span className="flex-1">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {item.badge}
              </Badge>
            )}
            {hasChildren &&
              (isExpanded ? (
                <ChevronDown className="h-4 w-4 ml-2" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-2" />
              ))}
          </>
        ) : null}
      </Button>
    );

    return (
      <div key={item.title}>
        {item.description ? (
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent>
              <p>{item.description}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          buttonContent
        )}

        {hasChildren && isExpanded && !isCollapsed && (
          <div className="ml-2 mt-1 space-y-1">
            {item.children!.map((child) => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div
        className={cn('flex flex-col h-full bg-background border-r', className)}
      >
        {/* Header */}
        <div className={cn('bg-primary border-primary border-b', isCollapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <Building2 className="h-6 w-6 text-primary-foreground" />
                <div>
                  <h2 className="font-bold text-sm text-primary-foreground">MOPC</h2>
                  <p className="text-xs text-primary-foreground/80">
                    Sistema de Expropiación
                  </p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <Building2 className="h-6 w-6 text-primary-foreground mx-auto" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-1 h-8 w-8 hover:bg-primary-foreground/10 text-primary-foreground"
            >
              {isCollapsed ? (
                <Menu className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* User Info */}
        {!isCollapsed && (
          <div className="p-4 border-b">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                {user?.firstName?.[0] || user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn('space-y-2', isCollapsed ? 'p-2' : 'p-4')}>
          {navigationItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Footer */}
        <div className={cn('border-t space-y-2', isCollapsed ? 'p-2' : 'p-4')}>
          {!isCollapsed && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => (window.location.href = '/search')}
              >
                <Search className="h-4 w-4 mr-3" />
                Búsqueda global
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10',
              isCollapsed && 'justify-center'
            )}
            onClick={signOut}
          >
            <LogOut className={cn('h-4 w-4', isCollapsed ? '' : 'mr-3')} />
            {!isCollapsed && 'Cerrar Sesión'}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
