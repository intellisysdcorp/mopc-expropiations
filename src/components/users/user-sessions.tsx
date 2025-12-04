'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  AlertTriangle,
  Trash2,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface Session {
  id: string;
  sessionToken: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastAccessAt: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: any;
  isCurrent: boolean;
}

interface UserSessionsProps {
  userId: string;
  userName: string;
}

export function UserSessions({ userId }: UserSessionsProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState<Session | null>(null);
  const [terminating, setTerminating] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        activeOnly: activeOnly.toString(),
      });

      const response = await fetch(`/api/users/${userId}/sessions?${params}`);
      if (!response.ok) {throw new Error('Error fetching sessions');}

      const data = await response.json();
      setSessions(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching sessions:', error);
        toast.error('Error al cargar las sesiones');
      }
    } finally {
      setLoading(false);
    }
  }, [activeOnly, userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) {return <Monitor className="h-4 w-4" />;}

    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceInfo = (session: Session) => {
    if (session.deviceInfo) {
      return session.deviceInfo;
    }

    // Extract info from user agent
    const userAgent = session.userAgent || '';
    let browser = 'Desconocido';
    let os = 'Desconocido';

    // Simple user agent parsing
    if (userAgent.includes('Chrome')) {browser = 'Chrome';}
    else if (userAgent.includes('Firefox')) {browser = 'Firefox';}
    else if (userAgent.includes('Safari')) {browser = 'Safari';}
    else if (userAgent.includes('Edge')) {browser = 'Edge';}

    if (userAgent.includes('Windows')) {os = 'Windows';}
    else if (userAgent.includes('Mac')) {os = 'macOS';}
    else if (userAgent.includes('Linux')) {os = 'Linux';}
    else if (userAgent.includes('Android')) {os = 'Android';}
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {os = 'iOS';}

    return { browser, os };
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

  const getSessionStatus = (session: Session) => {
    if (!session.isActive) {
      return { label: 'Inactiva', variant: 'secondary' as const };
    }

    const expiresAt = new Date(session.expiresAt);
    const now = new Date();

    if (expiresAt <= now) {
      return { label: 'Expirada', variant: 'destructive' as const };
    }

    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilExpiry < 1) {
      return { label: 'Por expirar', variant: 'outline' as const };
    }

    return { label: 'Activa', variant: 'default' as const };
  };

  const terminateSession = async (session: Session) => {
    setTerminating(true);
    try {
      const response = await fetch(`/api/users/${userId}/sessions?sessionId=${session.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al terminar la sesión');
      }

      toast.success('Sesión terminada correctamente');
      setShowTerminateDialog(false);
      setSessionToTerminate(null);
      await fetchSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al terminar la sesión');
    } finally {
      setTerminating(false);
    }
  };

  const terminateAllSessions = async (exceptCurrent = false) => {
    setTerminating(true);
    try {
      const params = new URLSearchParams();
      if (exceptCurrent) {
        params.append('exceptCurrent', 'true');
      }

      const response = await fetch(`/api/users/${userId}/sessions?${params}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al terminar las sesiones');
      }

      const result = await response.json();
      toast.success(result.message);
      await fetchSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al terminar las sesiones');
    } finally {
      setTerminating(false);
    }
  };

  const activeSessionsCount = sessions.filter(s => s.isActive && new Date(s.expiresAt) > new Date()).length;
  const currentSession = sessions.find(s => s.isCurrent);

  return (
    <div className="space-y-6">
      {/* Session Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesiones Activas</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSessionsCount}</div>
            <p className="text-xs text-muted-foreground">
              {currentSession ? 'Incluyendo la sesión actual' : 'Sin sesión actual'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(sessions.map(s => s.userAgent)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Dispositivos únicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Actividad</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {sessions.length > 0 ? formatDate(sessions[0]!.lastAccessAt) : 'Nunca'}
            </div>
            {currentSession && (
              <p className="text-xs text-muted-foreground">
                Sesión actual activa
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controles de Sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mostrar solo sesiones activas</Label>
              <p className="text-sm text-muted-foreground">
                Filtra las sesiones que están actualmente activas y no han expirado
              </p>
            </div>
            <Switch
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fetchSessions()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>

            {activeSessionsCount > 0 && (
              <Button
                variant="outline"
                onClick={() => terminateAllSessions(currentSession !== undefined)}
                disabled={terminating}
              >
                <Shield className="h-4 w-4 mr-2" />
                Terminar Todas{currentSession ? ' (excepto actual)' : ''}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sesiones de Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeOnly ? 'No hay sesiones activas' : 'No hay sesiones registradas'}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creada</TableHead>
                    <TableHead>Último Acceso</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const deviceInfo = getDeviceInfo(session);
                    const status = getSessionStatus(session);

                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getDeviceIcon(session.userAgent)}
                            <div>
                              <div className="font-medium">{deviceInfo.browser}</div>
                              <div className="text-sm text-muted-foreground">
                                {deviceInfo.os}
                              </div>
                              {session.isCurrent && (
                                <Badge variant="outline" className="mt-1">
                                  Sesión Actual
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span>{session.ipAddress || 'Desconocida'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(session.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(session.lastAccessAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(session.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {session.isActive && !session.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSessionToTerminate(session);
                                  setShowTerminateDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {session.isCurrent && (
                              <Badge variant="outline" className="text-xs">
                                Actual
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Alert */}
      {activeSessionsCount > 3 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este usuario tiene {activeSessionsCount} sesiones activas.
            Considera terminar las sesiones no utilizadas para mejorar la seguridad.
          </AlertDescription>
        </Alert>
      )}

      {/* Terminate Session Dialog */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Terminar Sesión?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas terminar esta sesión?
              El usuario deberá iniciar sesión nuevamente en este dispositivo.
              {sessionToTerminate?.isCurrent && (
                <span className="text-destructive font-medium">
                  {' '}Esta es tu sesión actual y serás desconectado.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTerminateDialog(false);
                setSessionToTerminate(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => sessionToTerminate && terminateSession(sessionToTerminate)}
              disabled={terminating}
            >
              {terminating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Terminando...
                </div>
              ) : (
                'Terminar Sesión'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}