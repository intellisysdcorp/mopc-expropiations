'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  X,
  Clock,
  AlertTriangle,
  Info,
  FileText,
  User,
  Calendar,
  Trash2,
  Archive,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'TASK_ASSIGNED' | 'DEADLINE_REMINDER' | 'STATUS_UPDATE' | 'SYSTEM_ANNOUNCEMENT';
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sendEmail: boolean;
  emailSent: boolean;
  metadata?: any;
  case?: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: string;
    status: string;
    priority: string;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

interface NotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({ className, onNotificationClick }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=50');

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setStats({
        total: data.statistics.total,
        unread: data.statistics.unread,
        byType: data.statistics.byType
      });
    } catch (error) {
      clientLogger.error('Error fetching notifications:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    // Auto-refresh notifications every 30 seconds when dropdown is open
    if (isOpen) {
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchNotifications]);

  const markAsRead = async (notificationId: string, isRead: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, isRead, readAt: isRead ? new Date() : undefined }
            : n
        )
      );

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          unread: isRead ? Math.max(0, stats.unread - 1) : stats.unread + 1
        });
      }

    } catch (error) {
      toast.error('Error al actualizar notificación');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Update stats
      if (stats) {
        const deletedNotification = notifications.find(n => n.id === notificationId);
        setStats({
          ...stats,
          total: stats.total - 1,
          unread: deletedNotification && !deletedNotification.isRead
            ? Math.max(0, stats.unread - 1)
            : stats.unread
        });
      }

      toast.success('Notificación eliminada');

    } catch (error) {
      toast.error('Error al eliminar notificación');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);

      if (unreadNotifications.length === 0) return;

      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_read',
          notificationIds: unreadNotifications.map(n => n.id)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date() }))
      );

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          unread: 0
        });
      }

      toast.success('Todas las notificaciones marcadas como leídas');

    } catch (error) {
      toast.error('Error al marcar notificaciones como leídas');
    }
  };

  const handleBulkAction = async (action: 'mark_read' | 'mark_unread' | 'delete') => {
    if (selectedNotifications.size === 0) {
      toast.error('Seleccione al menos una notificación');
      return;
    }

    try {
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notificationIds: Array.from(selectedNotifications)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform bulk action');
      }

      const result = await response.json();

      // Update local state based on action
      if (action === 'delete') {
        setNotifications(prev =>
          prev.filter(n => !selectedNotifications.has(n.id))
        );

        if (stats) {
          const deletedUnread = notifications.filter(n =>
            selectedNotifications.has(n.id) && !n.isRead
          ).length;

          setStats({
            ...stats,
            total: stats.total - selectedNotifications.size,
            unread: stats.unread - deletedUnread
          });
        }
      } else {
        setNotifications(prev =>
          prev.map(n =>
            selectedNotifications.has(n.id)
              ? { ...n, isRead: action === 'mark_read', readAt: action === 'mark_read' ? new Date() : undefined }
              : n
          )
        );

        if (stats && action === 'mark_read') {
          const markedAsRead = Array.from(selectedNotifications).filter(id =>
            notifications.find(n => n.id === id && !n.isRead)
          ).length;

          setStats({
            ...stats,
            unread: Math.max(0, stats.unread - markedAsRead)
          });
        }
      }

      setSelectedNotifications(new Set());
      toast.success(result.message);

    } catch (error) {
      toast.error('Error al realizar acción masiva');
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'urgent' ? 'text-red-500' :
                     priority === 'high' ? 'text-orange-500' :
                     priority === 'medium' ? 'text-yellow-500' :
                     'text-gray-500';

    switch (type) {
      case 'TASK_ASSIGNED':
        return <User className={cn('h-4 w-4', iconClass)} />;
      case 'DEADLINE_REMINDER':
        return <Clock className={cn('h-4 w-4', iconClass)} />;
      case 'STATUS_UPDATE':
        return <Info className={cn('h-4 w-4', iconClass)} />;
      case 'WARNING':
        return <AlertTriangle className={cn('h-4 w-4', iconClass)} />;
      case 'ERROR':
        return <X className={cn('h-4 w-4', iconClass)} />;
      case 'SUCCESS':
        return <CheckCircle2 className={cn('h-4 w-4', iconClass)} />;
      default:
        return <Bell className={cn('h-4 w-4', iconClass)} />;
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Ahora';
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;

    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: numeric
    }).format(new Date(date));
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = stats?.unread || 0;

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('relative', className)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  {unreadCount > 0 ? (
                    <BellRing className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Notificaciones{unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}</p>
              </TooltipContent>
            </Tooltip>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-96 p-0">
          <DropdownMenuLabel className="flex items-center justify-between p-4 border-b">
            <span className="font-semibold">Notificaciones</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead();
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Marcar todas como leídas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  fetchNotifications();
                }}
              >
                Actualizar
              </Button>
            </div>
          </DropdownMenuLabel>

          {/* Filter Tabs */}
          <div className="flex border-b">
            {(['all', 'unread', 'read'] as const).map((filterType) => (
              <button
                key={filterType}
                className={cn(
                  'flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                  filter === filterType
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
                onClick={() => setFilter(filterType)}
              >
                {filterType === 'all' && 'Todas'}
                {filterType === 'unread' && 'No leídas'}
                {filterType === 'read' && 'Leídas'}
                {filterType === 'unread' && unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <ScrollArea className="h-96">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {filter === 'unread' ? 'No hay notificaciones sin leer' :
                   filter === 'read' ? 'No hay notificaciones leídas' :
                   'No hay notificaciones'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'relative flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors',
                      !notification.isRead && 'bg-blue-50 border-l-4 border-blue-500'
                    )}
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsRead(notification.id, true);
                      }
                      if (onNotificationClick) {
                        onNotificationClick(notification);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedNotifications(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(notification.id)) {
                            newSet.delete(notification.id);
                          } else {
                            newSet.add(notification.id);
                          }
                          return newSet;
                        });
                      }}
                      className="mt-1 rounded"
                    />

                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className={cn(
                          'text-sm font-medium line-clamp-1',
                          !notification.isRead && 'font-semibold'
                        )}>
                          {notification.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {notification.message}
                      </p>

                      {notification.case && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {notification.case.fileNumber}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {notification.case.title}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id, true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Marcar como leído
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Bulk Actions */}
          {selectedNotifications.size > 0 && (
            <div className="border-t p-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {selectedNotifications.size} seleccionada{selectedNotifications.size > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction('mark_read')}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar leídas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction('delete')}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}