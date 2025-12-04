'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  User,
  FileText,
  Settings,
  Shield,
  Activity,
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata: any;
  createdAt: string;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
}

interface ActivityStats {
  actionStats: Array<{ action: string; _count: { action: number } }>;
  entityTypeStats: Array<{ entityType: string; _count: { entityType: number } }>;
  recentLoginActivity: Array<{
    action: string;
    createdAt: string;
    metadata: any;
  }>;
  passwordHistory: Array<{
    changedAt: string;
    changeReason: string;
    ipAddress: string;
    userAgent: string;
  }>;
  securityInfo: {
    failedLoginAttempts: number;
    lockedUntil: string | null;
    lastLoginAt: string | null;
    lastLoginIp: string | null;
    lastLoginUserAgent: string | null;
  };
}

interface UserActivityHistoryProps {
  userId: string;
  userName: string;
}

export function UserActivityHistory({ userId, userName }: UserActivityHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [filters, setFilters] = useState({
    type: 'ALL',
    entityType: 'ALL',
    startDate: '',
    endDate: '',
    search: '',
  });

  const fetchActivityHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'ALL')
        ),
      });

      const response = await fetch(`/api/users/${userId}/activity?${params}`);
      if (!response.ok) {throw new Error('Error fetching activity history');}

      const data = await response.json();
      setActivities(data.activities);
      setStats(data.statistics);
      setPagination(data.pagination);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching activity history:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, userId]);

  useEffect(() => {
    fetchActivityHistory();
  }, [fetchActivityHistory]);

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
      case 'logout':
        return <User className="h-4 w-4" />;
      case 'created':
      case 'updated':
      case 'deleted':
        return <Settings className="h-4 w-4" />;
      case 'uploaded':
      case 'downloaded':
        return <FileText className="h-4 w-4" />;
      case 'approved':
      case 'rejected':
        return <Shield className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'default';
      case 'updated':
        return 'secondary';
      case 'deleted':
        return 'destructive';
      case 'login':
        return 'outline';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatActionName = (action: string) => {
    const actionNames: Record<string, string> = {
      CREATED: 'Creado',
      UPDATED: 'Actualizado',
      DELETED: 'Eliminado',
      ASSIGNED: 'Asignado',
      REASSIGNED: 'Reasignado',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
      COMMENTED: 'Comentado',
      UPLOADED: 'Subido',
      DOWNLOADED: 'Descargado',
      VIEWED: 'Visto',
      ARCHIVED: 'Archivado',
      RESTORED: 'Restaurado',
      EXPORTED: 'Exportado',
      IMPORTED: 'Importado',
      LOGIN: 'Inicio de Sesión',
      LOGOUT: 'Cierre de Sesión',
      PASSWORD_CHANGED: 'Contraseña Cambiada',
      FAILED_LOGIN: 'Login Fallido',
    };

    return actionNames[action] || action;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'ALL')
        ),
      });

      const response = await fetch(`/api/users/${userId}/activity/export?${params}`);
      if (!response.ok) {throw new Error('Error exporting activity');}

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `actividad-${userName.replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error exporting activity:', error);
      }
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actividades</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Intentos Fallidos</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.securityInfo.failedLoginAttempts}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Último Login</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.securityInfo.lastLoginAt
                  ? formatDate(stats.securityInfo.lastLoginAt)
                  : 'Nunca'}
              </div>
              {stats.securityInfo.lastLoginIp && (
                <div className="text-xs text-muted-foreground">
                  IP: {stats.securityInfo.lastLoginIp}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado Cuenta</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.securityInfo.lockedUntil && stats.securityInfo.lockedUntil > new Date().toISOString() ? (
                  <Badge variant="destructive">Bloqueada</Badge>
                ) : (
                  <Badge variant="default">Normal</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filtros</span>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Buscar actividad..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />

            <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="CREATED">Creado</SelectItem>
                <SelectItem value="UPDATED">Actualizado</SelectItem>
                <SelectItem value="DELETED">Eliminado</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.entityType} onValueChange={(value) => setFilters({ ...filters, entityType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="case">Caso</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="department">Departamento</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />

            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity Details */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList>
          <TabsTrigger value="recent">Actividad Reciente</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
          <TabsTrigger value="password">Historial de Contraseñas</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron actividades
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="mt-1">
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionBadgeVariant(activity.action)}>
                            {formatActionName(activity.action)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {activity.entityType}
                          </Badge>
                        </div>
                        <div className="text-sm">{activity.description}</div>
                        {activity.case && (
                          <div className="text-xs text-muted-foreground">
                            Caso: {activity.case.caseNumber} - {activity.case.title}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatDate(activity.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                        {pagination.total} actividades
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                          disabled={pagination.page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Página {pagination.page} de {pagination.pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                          disabled={pagination.page === pagination.pages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats?.actionStats && stats.actionStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Acciones más Comunes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.actionStats.map((stat, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{formatActionName(stat.action)}</span>
                        <Badge variant="outline">{stat._count.action}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {stats?.entityTypeStats && stats.entityTypeStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tipos de Entidad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.entityTypeStats.map((stat, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{stat.entityType}</span>
                        <Badge variant="outline">{stat._count.entityType}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información de Seguridad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats?.recentLoginActivity && stats.recentLoginActivity.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Inicios de Sesión Recientes</h4>
                  <div className="space-y-2">
                    {stats.recentLoginActivity.map((login, index) => (
                      <div key={index} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <Badge variant={login.action === 'LOGIN' ? 'default' : 'secondary'}>
                            {login.action === 'LOGIN' ? 'Inicio' : 'Cierre'} de Sesión
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(login.createdAt)}
                          </div>
                        </div>
                        {login.metadata?.ipAddress && (
                          <div className="text-xs text-muted-foreground">
                            IP: {login.metadata.ipAddress}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Cambios de Contraseña</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.passwordHistory && stats.passwordHistory.length > 0 ? (
                <div className="space-y-2">
                  {stats.passwordHistory.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <div className="font-medium">{formatDate(entry.changedAt)}</div>
                        <div className="text-sm text-muted-foreground">
                          Razón: {entry.changeReason || 'No especificada'}
                        </div>
                        {entry.ipAddress && (
                          <div className="text-xs text-muted-foreground">
                            IP: {entry.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay historial de cambios de contraseña
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}