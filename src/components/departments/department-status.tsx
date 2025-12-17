'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'react-hot-toast';
import {
  Power,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  History,
  Users,
  FileText,
  Calendar,
  AlertCircle,
  Ban,
  Play,
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

interface StatusChange {
  id: string;
  action: string;
  description: string;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSuspended?: boolean;
  userCount: number;
  caseCount: number;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
}

interface DepartmentStatusProps {
  departmentId: string;
  department: Department;
  onStatusUpdated?: () => void;
}

export function DepartmentStatus({
  departmentId,
  department,
  onStatusUpdated,
}: DepartmentStatusProps) {
  const [loading, setLoading] = useState(true);
  const [statusHistory, setStatusHistory] = useState<StatusChange[]>([]);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate' | 'suspend' | 'unsuspend'>('activate');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch status history
  const fetchStatusHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/departments/${departmentId}/status`);
      if (!response.ok) {throw new Error('Error fetching status history');}

      const data = await response.json();
      setStatusHistory(data.statusHistory || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error('Error al cargar historial de estado');
        clientLogger.error('Error fetching status history:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchStatusHistory();
  }, [fetchStatusHistory]);

  // Handle status change
  const handleStatusChange = async () => {
    if (statusAction === 'suspend' && !suspensionReason.trim()) {
      toast.error('La razón de la suspensión es requerida');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {};

      switch (statusAction) {
        case 'activate':
          updateData.isActive = true;
          updateData.isSuspended = false;
          break;
        case 'deactivate':
          updateData.isActive = false;
          break;
        case 'suspend':
          updateData.isSuspended = true;
          updateData.suspensionReason = suspensionReason;
          break;
        case 'unsuspend':
          updateData.isSuspended = false;
          updateData.suspensionReason = null;
          break;
      }

      if (notes) {
        updateData.notes = notes;
      }

      const response = await fetch(`/api/departments/${departmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cambiar estado');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowStatusDialog(false);
      setSuspensionReason('');
      setNotes('');
      setStatusAction('activate');
      await fetchStatusHistory();
      onStatusUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cambiar estado');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get status color and icon
  const getStatusInfo = () => {
    if (department.isSuspended) {
      return {
        color: 'destructive',
        icon: <Ban className="h-4 w-4" />,
        label: 'Suspendido',
        description: department.suspensionReason || 'Suspendido sin razón especificada',
      };
    }
    if (department.isActive) {
      return {
        color: 'default',
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Activo',
        description: 'Departamento operativo y funcional',
      };
    }
    return {
      color: 'secondary',
      icon: <XCircle className="h-4 w-4" />,
      label: 'Inactivo',
      description: 'Departamento no operativo temporalmente',
    };
  };

  const statusInfo = getStatusInfo();

  // Get available actions based on current status
  const getAvailableActions = () => {
    const actions = [];

    if (department.isSuspended) {
      actions.push({
        value: 'unsuspend' as const,
        label: 'Reactivar',
        icon: <Play className="h-4 w-4" />,
        description: 'Reactivar el departamento suspendido',
        variant: 'default' as const,
      });
    } else if (department.isActive) {
      actions.push({
        value: 'deactivate' as const,
        label: 'Desactivar',
        icon: <Power className="h-4 w-4" />,
        description: 'Desactivar temporalmente el departamento',
        variant: 'outline' as const,
      });
      actions.push({
        value: 'suspend' as const,
        label: 'Suspender',
        icon: <Ban className="h-4 w-4" />,
        description: 'Suspender el departamento por razones específicas',
        variant: 'destructive' as const,
      });
    } else {
      actions.push({
        value: 'activate' as const,
        label: 'Activar',
        icon: <Play className="h-4 w-4" />,
        description: 'Activar el departamento inactivo',
        variant: 'default' as const,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  // Get status change icon
  const getStatusChangeIcon = (action: string) => {
    switch (action) {
      case 'Activado':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'Desactivado':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      case 'Suspendido':
        return <Ban className="h-4 w-4 text-red-600" />;
      case 'Reactivado':
        return <Play className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Estado del Departamento
          </h2>
          <p className="text-muted-foreground">
            {department.name} ({department.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchStatusHistory}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Estado Actual
            <Badge variant={statusInfo.color as any} className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.label}
            </Badge>
          </CardTitle>
          <CardDescription>
            Estado operativo actual del departamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-muted rounded-lg">
                {statusInfo.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{statusInfo.label}</div>
                <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
              </div>
            </div>

            {/* Additional Status Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{department.userCount} usuarios</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{department.caseCount} casos</span>
              </div>
              {department.suspendedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Suspendido: {new Date(department.suspendedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-4">
              {availableActions.map((action) => (
                <Button
                  key={action.value}
                  variant={action.variant}
                  onClick={() => {
                    setStatusAction(action.value);
                    setShowStatusDialog(true);
                  }}
                  className="flex items-center gap-2"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Cambios de Estado
          </CardTitle>
          <CardDescription>
            Registro de todos los cambios de estado del departamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay historial</h3>
              <p className="text-muted-foreground">
                No se han registrado cambios de estado para este departamento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {statusHistory.map((change) => (
                <div key={change.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                    {getStatusChangeIcon(change.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{change.action}</span>
                      <Badge variant="outline" className="text-xs">
                        {new Date(change.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {change.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Por: {change.user.firstName} {change.user.lastName}</span>
                      <span>•</span>
                      <span>{change.user.email}</span>
                    </div>
                    {change.metadata?.changes && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="font-medium mb-1">Cambios realizados:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {change.metadata.changes.map((changeItem: string, idx: number) => (
                            <li key={idx}>{changeItem}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {change.metadata?.reason && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <div className="font-medium mb-1">Razón:</div>
                        <p>{change.metadata.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Cambiar Estado del Departamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de cambiar el estado del departamento &quot;{department.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Action Description */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {availableActions.find(a => a.value === statusAction)?.icon}
                <span className="font-medium">
                  {availableActions.find(a => a.value === statusAction)?.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {availableActions.find(a => a.value === statusAction)?.description}
              </p>
            </div>

            {/* Suspension Reason (if suspending) */}
            {statusAction === 'suspend' && (
              <div>
                <Label htmlFor="suspensionReason">Razón de la Suspensión *</Label>
                <Textarea
                  id="suspensionReason"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Describe la razón por la cual se está suspendiendo este departamento..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            )}

            {/* Additional Notes */}
            <div>
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cualquier información adicional relevante sobre este cambio de estado..."
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Impact Warning */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-yellow-800">Advertencia de Impacto</div>
                  <div className="text-yellow-700 mt-1">
                    {statusAction === 'suspend' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Se suspenderán automáticamente todos los usuarios del departamento</li>
                        <li>Los casos activos podrían verse afectados</li>
                        <li>Se limitará el acceso a las funciones del departamento</li>
                      </ul>
                    )}
                    {statusAction === 'deactivate' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>El departamento no podrá recibir nuevos casos</li>
                        <li>Se limitará el acceso a funciones operativas</li>
                        <li>Los usuarios podrán seguir accediendo con permisos limitados</li>
                      </ul>
                    )}
                    {statusAction === 'unsuspend' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Se reactivarán los usuarios suspendidos automáticamente</li>
                        <li>El departamento volverá a estar totalmente operativo</li>
                        <li>Se restaurarán todas las funciones del departamento</li>
                      </ul>
                    )}
                    {statusAction === 'activate' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>El departamento volverá a estar operativo</li>
                        <li>Se podrán asignar nuevos casos al departamento</li>
                        <li>Se restaurarán todas las funciones del departamento</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={isSubmitting || (statusAction === 'suspend' && !suspensionReason.trim())}
              className={statusAction === 'suspend' ? 'bg-destructive text-destructive-foreground' : ''}
            >
              {isSubmitting ? 'Procesando...' : availableActions.find(a => a.value === statusAction)?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}