'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellRing,
  X,
  Check,
  Eye,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { useWebSocket } from '@/hooks/use-websocket';

interface UnreadIndicatorProps {
  className?: string;
  showCount?: boolean;
  maxPreview?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  variant?: 'badge' | 'dot' | 'counter';
  size?: 'sm' | 'md' | 'lg';
  onNotificationClick?: (notification: any) => void;
}

interface PreviewNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  createdAt: Date;
  metadata?: any;
}

export function UnreadIndicator({
  className,
  showCount = true,
  maxPreview = 5,
  position = 'top-right',
  variant = 'badge',
  size = 'md',
  onNotificationClick
}: UnreadIndicatorProps) {
  const {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    error
  } = useWebSocket({
    autoConnect: true,
    reconnection: true
  });

  const [isOpen, setIsOpen] = useState(false);

  // Get unread notifications for preview
  const unreadNotifications = notifications.filter(n => !n.isRead).slice(0, maxPreview);

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'urgent' || priority === 'critical' ? 'text-red-500' :
                     priority === 'high' ? 'text-orange-500' :
                     priority === 'medium' ? 'text-yellow-500' :
                     'text-gray-500';

    switch (type.toLowerCase()) {
      case 'task_assigned':
        return <User className={cn('h-4 w-4', iconClass)} />;
      case 'deadline_reminder':
        return <Clock className={cn('h-4 w-4', iconClass)} />;
      case 'status_update':
        return <Info className={cn('h-4 w-4', iconClass)} />;
      case 'warning':
        return <AlertTriangle className={cn('h-4 w-4', iconClass)} />;
      case 'error':
        return <X className={cn('h-4 w-4', iconClass)} />;
      case 'success':
        return <CheckCircle2 className={cn('h-4 w-4', iconClass)} />;
      default:
        return <Bell className={cn('h-4 w-4', iconClass)} />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;

    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit'
    }).format(new Date(date));
  };

  const handleNotificationClick = (notification: PreviewNotification) => {
    markAsRead(notification.id);
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setIsOpen(false);
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = unreadNotifications.map(n => n.id);

      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_read',
          notificationIds: unreadIds
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      // Mark all as read in local state
      unreadIds.forEach(id => markAsRead(id));
      toast.success('Todas las notificaciones marcadas como leídas');

    } catch (_) {
      toast.error('Error al marcar notificaciones como leídas');
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-0 right-0';
      case 'top-left':
        return 'top-0 left-0';
      case 'bottom-right':
        return 'bottom-0 right-0';
      case 'bottom-left':
        return 'bottom-0 left-0';
      default:
        return 'top-0 right-0';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 w-8';
      case 'md':
        return 'h-10 w-10';
      case 'lg':
        return 'h-12 w-12';
      default:
        return 'h-10 w-10';
    }
  };

  const renderIndicator = () => {
    const baseClasses = cn(
      'relative inline-flex items-center justify-center rounded-full transition-colors',
      getSizeClasses(),
      className
    );

    if (variant === 'dot') {
      return (
        <div className={cn(baseClasses, 'bg-blue-500')}>
          {unreadCount > 0 && (
            <div className={cn(
              'absolute rounded-full bg-red-500 animate-pulse',
              size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5',
              getPositionClasses()
            )} />
          )}
          <Bell className="h-4 w-4 text-white" />
        </div>
      );
    }

    if (variant === 'counter') {
      return (
        <div className={cn(baseClasses, 'bg-blue-600 text-white')}>
          {unreadCount > 0 ? (
            <span className="text-sm font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <Bell className="h-4 w-4" />
          )}
        </div>
      );
    }

    // Default badge variant
    return (
      <div className={cn(baseClasses, 'bg-gray-100 hover:bg-gray-200')}>
        {unreadCount > 0 ? (
          <BellRing className="h-4 w-4 text-blue-600" />
        ) : (
          <Bell className="h-4 w-4 text-gray-600" />
        )}
        {showCount && unreadCount > 0 && (
          <Badge
            variant="destructive"
            className={cn(
              'absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center',
              size === 'lg' ? 'h-6 w-6 text-xs' : 'h-5 w-5 text-xs'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2"
        >
          {renderIndicator()}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={5}>
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificaciones No Leídas</h4>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 px-2"
              >
                <Check className="h-3 w-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        {unreadNotifications.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-gray-500">No hay notificaciones pendientes</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-1">
              {unreadNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h5 className="text-sm font-medium line-clamp-1">
                        {notification.title}
                      </h5>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatTime(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {notification.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            Urgente
                          </Badge>
                        )}
                        {notification.priority === 'high' && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            Alta
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {unreadNotifications.length > 0 && (
          <div className="p-3 border-t bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} sin leer
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  // Navigate to full notification center
                  window.location.href = '/notifications';
                }}
              >
                Ver todas
              </Button>
            </div>
          </div>
        )}

        {/* Connection status indicator */}
        <div className="p-2 border-t bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="text-gray-600">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            {error && (
              <span className="text-red-500">
                Error de conexión
              </span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Standalone component for embedding in headers
export function HeaderNotificationIndicator({ className }: { className?: string }) {
  return (
    <div className={className}>
      <UnreadIndicator
        variant="badge"
        size="md"
        showCount={true}
        maxPreview={3}
        onNotificationClick={(notification) => {
          // Handle notification click
          if (notification.metadata?.caseId) {
            window.location.href = `/cases/${notification.metadata.caseId}`;
          } else if (notification.metadata?.meetingId) {
            window.location.href = `/meetings/${notification.metadata.meetingId}`;
          }
        }}
      />
    </div>
  );
}

// Compact indicator for sidebar or navigation
export function CompactNotificationIndicator({ className }: { className?: string }) {
  return (
    <div className={className}>
      <UnreadIndicator
        variant="dot"
        size="sm"
        showCount={false}
        maxPreview={5}
      />
    </div>
  );
}

// Floating indicator for mobile views
export function FloatingNotificationIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      <UnreadIndicator
        variant="counter"
        size="lg"
        showCount={true}
        maxPreview={5}
        position="top-right"
      />
    </div>
  );
}

export default UnreadIndicator;