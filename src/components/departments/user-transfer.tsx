'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'react-hot-toast';
import { Department, User } from '@/lib/types/department';
import {
  ArrowRightLeft,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  Mail,
  Briefcase,
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Schema for user transfer
const transferSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Selecciona al menos un usuario'),
  destinationDepartmentId: z.string().min(1, 'El departamento de destino es requerido'),
  transferType: z.enum(['PROMOTION', 'DEMOTION', 'LATERAL', 'TEMPORARY']),
  reason: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().optional(),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface UserTransferProps {
  sourceDepartmentId: string;
  sourceDepartmentName: string;
  users: User[];
  departments: Department[];
  onTransferComplete?: () => void;
  onCancel?: () => void;
}

interface TransferHistoryItem {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  sourceDepartment: {
    id: string;
    name: string;
    code: string;
  };
  destinationDepartment: {
    id: string;
    name: string;
    code: string;
  };
  transferType: string;
  status: string;
  reason?: string;
  scheduledFor?: string;
  completedAt?: string;
  createdAt: string;
}

export function UserTransfer({
  sourceDepartmentId,
  sourceDepartmentName,
  users,
  departments,
  onTransferComplete,
  onCancel,
}: UserTransferProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [transferPreview, setTransferPreview] = useState<TransferFormData | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      userIds: [],
      destinationDepartmentId: '',
      transferType: 'LATERAL',
      reason: '',
      notes: '',
    },
  });

  const destinationDepartmentId = watch('destinationDepartmentId');
  const transferType = watch('transferType');
  const scheduledFor = watch('scheduledFor');

  // Filter eligible departments (exclude source department and inactive departments)
  const eligibleDepartments = departments.filter(
    dept => dept.id !== sourceDepartmentId && dept.isActive
  );

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch transfer history
  useEffect(() => {
    const fetchTransferHistory = async () => {
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/departments/transfers?departmentId=${sourceDepartmentId}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setTransferHistory(data.transfers || []);
        }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching transfer history:', error);
      }
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchTransferHistory();
  }, [sourceDepartmentId]);

  // Handle user selection
  const handleUserToggle = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => {
      if (checked) {
        return [...prev, userId];
      } else {
        return prev.filter(id => id !== userId);
      }
    });
    setValue('userIds', checked ? [...selectedUsers, userId] : selectedUsers.filter(id => id !== userId));
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    const allUserIds = filteredUsers.map(user => user.id);
    setSelectedUsers(checked ? allUserIds : []);
    setValue('userIds', checked ? allUserIds : []);
  };

  // Handle form submission
  const handleFormSubmit = async (data: TransferFormData) => {
    if (selectedUsers.length === 0) {
      toast.error('Selecciona al menos un usuario para transferir');
      return;
    }

    setTransferPreview(data);
    setShowConfirmDialog(true);
  };

  // Execute transfer
  const executeTransfer = async () => {
    if (!transferPreview) {return;}

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/departments/${sourceDepartmentId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferPreview),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al realizar la transferencia');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowConfirmDialog(false);
      setSelectedUsers([]);
      reset();
      onTransferComplete?.();

      // Refresh transfer history
      const historyResponse = await fetch(`/api/departments/transfers?departmentId=${sourceDepartmentId}&limit=10`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setTransferHistory(historyData.transfers || []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al realizar la transferencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransferTypeLabel = (type: string) => {
    const labels = {
      PROMOTION: 'Promoción',
      DEMOTION: 'Democión',
      LATERAL: 'Transferencia Lateral',
      TEMPORARY: 'Transferencia Temporal',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'warning',
      IN_PROGRESS: 'info',
      COMPLETED: 'success',
      CANCELLED: 'destructive',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const destinationDepartment = eligibleDepartments.find(d => d.id === destinationDepartmentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Transferencia de Usuarios
          </h2>
          <p className="text-muted-foreground">
            Transferir usuarios del departamento <strong>{sourceDepartmentName}</strong>
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Form */}
        <Card>
          <CardHeader>
            <CardTitle>Configurar Transferencia</CardTitle>
            <CardDescription>
              Define los detalles de la transferencia de usuarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              {/* Destination Department */}
              <div>
                <Label htmlFor="destinationDepartmentId">Departamento de Destino *</Label>
                <Select
                  value={destinationDepartmentId}
                  onValueChange={(value) => setValue('destinationDepartmentId', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar departamento de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{dept.name}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {dept.userCount || 0} usuarios
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.destinationDepartmentId && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.destinationDepartmentId.message}
                  </p>
                )}
              </div>

              {/* Transfer Type */}
              <div>
                <Label htmlFor="transferType">Tipo de Transferencia *</Label>
                <Select
                  value={transferType}
                  onValueChange={(value) => setValue('transferType', value as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de transferencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROMOTION">Promoción</SelectItem>
                    <SelectItem value="DEMOTION">Democión</SelectItem>
                    <SelectItem value="LATERAL">Transferencia Lateral</SelectItem>
                    <SelectItem value="TEMPORARY">Transferencia Temporal</SelectItem>
                  </SelectContent>
                </Select>
                {errors.transferType && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.transferType.message}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="reason">Razón de la Transferencia</Label>
                <Textarea
                  id="reason"
                  {...register('reason')}
                  placeholder="Describe la razón de esta transferencia..."
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              {/* Scheduled Date */}
              <div>
                <Label htmlFor="scheduledFor">Fecha Programada (opcional)</Label>
                <Input
                  id="scheduledFor"
                  {...register('scheduledFor')}
                  type="datetime-local"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Si no especificas una fecha, la transferencia se realizará inmediatamente
                </p>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Cualquier información adicional relevante..."
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || selectedUsers.length === 0}
              >
                {isSubmitting ? 'Procesando...' : `Transferir ${selectedUsers.length} usuario(s)`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Usuarios</CardTitle>
            <CardDescription>
              {selectedUsers.length} de {users.length} usuarios seleccionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Select All */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="selectAll"
                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="selectAll" className="text-sm font-medium">
                Seleccionar todos ({filteredUsers.length})
              </Label>
            </div>

            {/* User List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No se encontraron usuarios
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${selectedUsers.includes(user.id) ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'}
                    `}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) => handleUserToggle(user.id, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {user.firstName} {user.lastName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {user.role.name}
                        </Badge>
                        {!user.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactivo
                          </Badge>
                        )}
                        {user.isSuspended && (
                          <Badge variant="destructive" className="text-xs">
                            Suspendido
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Preview */}
      {transferPreview && destinationDepartment && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Vista Previa de Transferencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Departamento Origen</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Building className="h-4 w-4" />
                  <span className="font-medium">{sourceDepartmentName}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Departamento Destino</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Building className="h-4 w-4" />
                  <span className="font-medium">{destinationDepartment.name}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Tipo</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-medium">{getTransferTypeLabel(transferPreview.transferType)}</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Usuarios a Transferir ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.slice(0, 10).map(userId => {
                  const user = users.find(u => u.id === userId);
                  return user ? (
                    <Badge key={userId} variant="secondary">
                      {user.firstName} {user.lastName}
                    </Badge>
                  ) : null;
                })}
                {selectedUsers.length > 10 && (
                  <Badge variant="outline">
                    +{selectedUsers.length - 10} más
                  </Badge>
                )}
              </div>
            </div>

            {transferPreview.reason && (
              <div className="mt-4">
                <Label className="text-sm text-muted-foreground">Razón</Label>
                <p className="text-sm mt-1">{transferPreview.reason}</p>
              </div>
            )}

            {scheduledFor && (
              <div className="mt-4">
                <Label className="text-sm text-muted-foreground">Fecha Programada</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    {new Date(scheduledFor).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Transferencias Recientes
          </CardTitle>
          <CardDescription>
            Transferencias que involucran este departamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : transferHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay transferencias recientes
            </p>
          ) : (
            <div className="space-y-4">
              {transferHistory.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">
                        {transfer.user.firstName} {transfer.user.lastName}
                      </span>
                      <Badge variant={getStatusColor(transfer.status) as any}>
                        {transfer.status}
                      </Badge>
                      <Badge variant="outline">
                        {getTransferTypeLabel(transfer.transferType)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {transfer.sourceDepartment.name} → {transfer.destinationDepartment.name}
                    </div>
                    {transfer.reason && (
                      <p className="text-sm mt-1">{transfer.reason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </div>
                    {transfer.scheduledFor && (
                      <div className="text-xs text-muted-foreground">
                        Programado: {new Date(transfer.scheduledFor).toLocaleDateString()}
                      </div>
                    )}
                    {transfer.completedAt && (
                      <div className="text-xs text-green-600">
                        Completado: {new Date(transfer.completedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Transferencia
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas transferir {selectedUsers.length} usuario(s) del departamento
              &quot;{sourceDepartmentName}&quot; al departamento &quot;{destinationDepartment?.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {transferPreview && (
            <div className="my-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Tipo:</span>
                  <span className="text-sm">{getTransferTypeLabel(transferPreview.transferType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Usuarios:</span>
                  <span className="text-sm">{selectedUsers.length}</span>
                </div>
                {scheduledFor && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Fecha:</span>
                    <span className="text-sm">
                      {new Date(scheduledFor).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeTransfer}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Transferencia'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}