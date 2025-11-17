'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
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
  Eye,
  Search,
  Filter,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { useWebSocket, NotificationData } from '@/hooks/use-websocket';
import clientLogger from '@/lib/client-logger';

interface EnhancedNotificationCenterProps {
  className?: string;
  onNotificationClick?: (notification: NotificationData) => void;
  maxVisible?: number;
  showConnectionStatus?: boolean;
}

interface NotificationFilter {
  type?: string;
  priority?: string;
  isRead?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export function EnhancedNotificationCenter({
  className,
  onNotificationClick,
  maxVisible = 50,
  showConnectionStatus = true
}: EnhancedNotificationCenterProps) {
  const {
    socket,
    isConnected,
    connectionStatus,
    notifications,
    unreadCount,
    onlineUsers,
    error,
    connect,
    disconnect,
    markAsRead,
    clearNotifications
  } = useWebSocket({
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState<NotificationFilter>({});

  // Fetch additional notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length < 10) {
      fetchMoreNotifications();
    }
  }, [isOpen]);

  // Auto-refresh notifications every 30 seconds when dropdown is open
  useEffect(() => {
    if (isOpen && isConnected) {
      const interval = setInterval(() => {
        // Real-time updates will come via WebSocket, but we can refresh if needed
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isConnected]);

  const fetchMoreNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=100');

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      // WebSocket will handle real-time updates, so we only fetch if needed
    } catch (error) {
      clientLogger.error('Error fetching notifications:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const markAsReadHandler = async (notificationId: string, isRead: boolean) => {
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

      markAsRead(notificationId);
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

      // Remove from local state
      // This will be handled by the WebSocket real-time updates
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

      // Mark all as read in local state
      unreadNotifications.forEach(n => markAsRead(n.id));
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
      toast.success(result.message);
      setSelectedNotifications(new Set());

    } catch (error) {
      toast.error('Error al realizar acción masiva');
    }
  };

  const clearAllNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear notifications');
      }

      clearNotifications();
      toast.success('Todas las notificaciones eliminadas');

    } catch (error) {
      toast.error('Error al eliminar notificaciones');
    }
  };

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
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Ahora';
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;

    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply read/unread filter
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.isRead);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }

    // Apply advanced filter
    if (advancedFilter.type) {
      filtered = filtered.filter(n => n.type === advancedFilter.type);
    }
    if (advancedFilter.priority) {
      filtered = filtered.filter(n => n.priority === advancedFilter.priority);
    }

    return filtered.slice(0, maxVisible);
  }, [notifications, filter, searchQuery, advancedFilter, maxVisible]);

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />;
      case 'error':
        return <WifiOff className="h-3 w-3 text-red-500" />;
      default:
        return <WifiOff className="h-3 w-3 text-gray-500" />;
    }
  };

  const getConnectionTooltip = () => {
    switch (connectionStatus) {
      case 'connected':
        return `Conectado • ${onlineUsers.length} usuarios en línea`;
      case 'connecting':
        return 'Conectando...';
      case 'error':
        return `Error: ${error || 'Desconocido'}`;
      default:
        return 'Desconectado';
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('relative', className)}>
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
            {showConnectionStatus && (
              <div className="absolute -bottom-1 -right-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-background rounded-full p-0.5 border">
                      {getConnectionStatusIcon()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getConnectionTooltip()}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-96 p-0 max-h-[80vh]">
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
                  Marcar todas
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  fetchMoreNotifications();
                }}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </DropdownMenuLabel>

          {/* Search Bar */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar notificaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

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
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
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
                        markAsReadHandler(notification.id, true);
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

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {formatTime(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReadHandler(notification.id, true);
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

          {/* Footer Actions */}
          <div className="border-t p-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {connectionStatus === 'connected' ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span>Conectado en tiempo real</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span>Conexión perdida</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={connect}
                    >
                      Reconectar
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllNotifications()}
                disabled={notifications.length === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpiar todo
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

export default EnhancedNotificationCenter;