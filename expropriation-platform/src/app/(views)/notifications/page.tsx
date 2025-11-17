'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  RefreshCw,
  Mail,
  MailOpen,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/hooks/use-auth'
import clientLogger from '@/lib/client-logger';

interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'TASK_ASSIGNED' | 'DEADLINE_REMINDER' | 'STATUS_UPDATE' | 'SYSTEM_ANNOUNCEMENT'
  isRead: boolean
  readAt?: Date
  createdAt: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  sendEmail: boolean
  emailSent: boolean
  metadata?: any
  case?: {
    id: string
    fileNumber: string
    title: string
    currentStage: string
    status: string
    priority: string
  }
  recipient: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface NotificationStats {
  total: number
  unread: number
  byType: Record<string, number>
  byPriority: Record<string, number>
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const { user } = useAuth()

  const fetchNotifications = useCallback(async (page = 1, append = false) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })

      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (filter !== 'all') params.append('isRead', filter === 'unread' ? 'false' : 'true')
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')

      const data = await response.json()

      if (append) {
        setNotifications(prev => [...prev, ...data.notifications])
      } else {
        setNotifications(data.notifications)
      }

      setStats({
        total: data.statistics.total,
        unread: data.statistics.unread,
        byType: data.statistics.byType,
        byPriority: data.statistics.byPriority || {}
      })

      setTotalPages(data.pagination.pages)
      setCurrentPage(data.pagination.page)

    } catch (error) {
      clientLogger.error('Error fetching notifications:', error)
      toast.error('Error al cargar notificaciones')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, priorityFilter, filter, searchQuery])

  useEffect(() => {
    fetchNotifications(1)
  }, [fetchNotifications])

  const markAsRead = async (notificationId: string, isRead: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      })

      if (!response.ok) throw new Error('Failed to update notification')

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, isRead, readAt: isRead ? new Date() : undefined }
            : n
        )
      )

      if (stats) {
        setStats({
          ...stats,
          unread: isRead ? Math.max(0, stats.unread - 1) : stats.unread + 1
        })
      }

    } catch (error) {
      toast.error('Error al actualizar notificación')
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete notification')

      setNotifications(prev => prev.filter(n => n.id !== notificationId))

      if (stats) {
        const deletedNotification = notifications.find(n => n.id === notificationId)
        setStats({
          ...stats,
          total: stats.total - 1,
          unread: deletedNotification && !deletedNotification.isRead
            ? Math.max(0, stats.unread - 1)
            : stats.unread
        })
      }

      toast.success('Notificación eliminada')

    } catch (error) {
      toast.error('Error al eliminar notificación')
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead)
      if (unreadNotifications.length === 0) return

      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notificationIds: unreadNotifications.map(n => n.id)
        }),
      })

      if (!response.ok) throw new Error('Failed to mark notifications as read')

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date() })))

      if (stats) {
        setStats({ ...stats, unread: 0 })
      }

      toast.success('Todas las notificaciones marcadas como leídas')

    } catch (error) {
      toast.error('Error al marcar notificaciones como leídas')
    }
  }

  const handleBulkAction = async (action: 'mark_read' | 'mark_unread' | 'delete') => {
    if (selectedNotifications.size === 0) {
      toast.error('Seleccione al menos una notificación')
      return
    }

    try {
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notificationIds: Array.from(selectedNotifications)
        }),
      })

      if (!response.ok) throw new Error('Failed to perform bulk action')

      const result = await response.json()

      if (action === 'delete') {
        setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)))
        if (stats) {
          const deletedUnread = notifications.filter(n =>
            selectedNotifications.has(n.id) && !n.isRead
          ).length
          setStats({
            ...stats,
            total: stats.total - selectedNotifications.size,
            unread: stats.unread - deletedUnread
          })
        }
      } else {
        setNotifications(prev =>
          prev.map(n =>
            selectedNotifications.has(n.id)
              ? { ...n, isRead: action === 'mark_read', readAt: action === 'mark_read' ? new Date() : undefined }
              : n
          )
        )
        if (stats && action === 'mark_read') {
          const markedAsRead = Array.from(selectedNotifications).filter(id =>
            notifications.find(n => n.id === id && !n.isRead)
          ).length
          setStats({
            ...stats,
            unread: Math.max(0, stats.unread - markedAsRead)
          })
        }
      }

      setSelectedNotifications(new Set())
      toast.success(result.message)

    } catch (error) {
      toast.error('Error al realizar acción masiva')
    }
  }

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'urgent' ? 'text-red-500' :
                     priority === 'high' ? 'text-orange-500' :
                     priority === 'medium' ? 'text-yellow-500' :
                     'text-gray-500'

    switch (type) {
      case 'TASK_ASSIGNED':
        return <User className={cn('h-4 w-4', iconClass)} />
      case 'DEADLINE_REMINDER':
        return <Clock className={cn('h-4 w-4', iconClass)} />
      case 'STATUS_UPDATE':
        return <Info className={cn('h-4 w-4', iconClass)} />
      case 'WARNING':
        return <AlertTriangle className={cn('h-4 w-4', iconClass)} />
      case 'ERROR':
        return <X className={cn('h-4 w-4', iconClass)} />
      case 'SUCCESS':
        return <CheckCircle2 className={cn('h-4 w-4', iconClass)} />
      default:
        return <Bell className={cn('h-4 w-4', iconClass)} />
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return 'Ahora'
    if (hours < 24) return `Hace ${hours}h`
    if (days < 7) return `Hace ${days}d`

    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const filteredNotifications = notifications.filter(n => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!n.title.toLowerCase().includes(query) &&
          !n.message.toLowerCase().includes(query)) {
        return false
      }
    }
    return true
  })

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      } else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }

  const selectAllVisible = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set())
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)))
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">
            Gestiona tus notificaciones y mantente al día con las actualizaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.unread ? (
            <Button onClick={markAllAsRead} variant="outline">
              <Check className="h-4 w-4 mr-2" />
              Marcar todas como leídas
            </Button>
          ) : null}
          <Button
            onClick={() => fetchNotifications(1)}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No leídas</CardTitle>
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.unread}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {notifications.filter(n => n.priority === 'urgent' && !n.isRead).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tareas asignadas</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {notifications.filter(n => n.type === 'TASK_ASSIGNED' && !n.isRead).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros y Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar notificaciones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="INFO">Información</SelectItem>
                <SelectItem value="WARNING">Advertencia</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="SUCCESS">Éxito</SelectItem>
                <SelectItem value="TASK_ASSIGNED">Tarea asignada</SelectItem>
                <SelectItem value="DEADLINE_REMINDER">Recordatorio</SelectItem>
                <SelectItem value="STATUS_UPDATE">Actualización</SelectItem>
                <SelectItem value="SYSTEM_ANNOUNCEMENT">Anuncio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Notificaciones</CardTitle>
              <CardDescription>
                {filteredNotifications.length} notificación{filteredNotifications.length !== 1 ? 'es' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedNotifications.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedNotifications.size} seleccionada{selectedNotifications.size > 1 ? 's' : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('mark_read')}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar leídas
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('delete')}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar
                  </Button>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllVisible}
              >
                {selectedNotifications.size === filteredNotifications.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No hay notificaciones</h3>
              <p className="text-sm">
                {searchQuery || typeFilter !== 'all' || priorityFilter !== 'all' || filter !== 'all'
                  ? 'No hay notificaciones que coincidan con los filtros seleccionados'
                  : 'No tienes notificaciones en este momento'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50',
                    !notification.isRead && 'bg-blue-50 border-blue-200'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedNotifications.has(notification.id)}
                    onChange={() => toggleNotificationSelection(notification.id)}
                    className="mt-1 rounded"
                  />

                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className={cn(
                          'font-medium line-clamp-1',
                          !notification.isRead && 'font-semibold'
                        )}>
                          {notification.title}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!notification.isRead && (
                            <DropdownMenuItem onClick={() => markAsRead(notification.id, true)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Marcar como leído
                            </DropdownMenuItem>
                          )}
                          {notification.isRead && (
                            <DropdownMenuItem onClick={() => markAsRead(notification.id, false)}>
                              <MailOpen className="h-4 w-4 mr-2" />
                              Marcar como no leído
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteNotification(notification.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {notification.case && (
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {notification.case.fileNumber}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {notification.case.title}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </span>
                        <Badge
                          variant={notification.priority === 'urgent' ? 'destructive' :
                                  notification.priority === 'high' ? 'destructive' :
                                  notification.priority === 'medium' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {notification.priority === 'urgent' ? 'Urgente' :
                           notification.priority === 'high' ? 'Alta' :
                           notification.priority === 'medium' ? 'Media' : 'Baja'}
                        </Badge>
                        {notification.sendEmail && (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}