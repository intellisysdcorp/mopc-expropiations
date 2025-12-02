'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Shield,
  Users,
  Settings,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  Calendar,
  UserCheck,
  Building,
  Key,
  Crown,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import clientLogger from '@/lib/client-logger';

interface Permission {
  id: string;
  name: string;
  type: string;
  description?: string;
  resource?: string;
  action?: string;
  isActive: boolean;
}

interface DepartmentPermission {
  id: string;
  permission: Permission;
  isGranted: boolean;
  assignedAt: string;
  assignedBy?: string;
  expiresAt?: string;
}

interface Role {
  id: string;
  name: string;
  users: Array<{
    id: string;
    name: string;
  }>;
  permissions?: Record<string, boolean>;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentPermissionsProps {
  departmentId: string;
  department: Department;
  onPermissionsUpdated?: () => void;
}

export function DepartmentPermissions({
  departmentId,
  department,
  onPermissionsUpdated,
}: DepartmentPermissionsProps) {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [departmentPermissions, setDepartmentPermissions] = useState<DepartmentPermission[]>([]);
  const [inheritedPermissions, setInheritedPermissions] = useState<any[]>([]);
  const [roleBasedPermissions, setRoleBasedPermissions] = useState<Role[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('direct');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, _setBulkAction] = useState<'grant' | 'revoke'>('grant');
  const [showExpirationDialog, setShowExpirationDialog] = useState(false);
  const [selectedPermissionForExpiration, setSelectedPermissionForExpiration] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState('');

  // Fetch permissions data
  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/departments/${departmentId}/permissions`);
      if (!response.ok) {throw new Error('Error fetching permissions');}

      const data = await response.json();
      setPermissions(data.allPermissions || []);
      setDepartmentPermissions(data.departmentPermissions || []);
      setInheritedPermissions(data.inheritedPermissions || []);
      setRoleBasedPermissions(data.roleBasedPermissions || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error('Error al cargar permisos');
        clientLogger.error('Error fetching permissions:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Filter permissions based on search
  const filteredPermissions = permissions.filter(permission =>
    permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.resource?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group permissions by type
  const permissionsByType = filteredPermissions.reduce((acc, permission) => {
    if (!acc[permission.type]) {
      acc[permission.type] = [];
    }
    acc[permission.type]!.push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Check if a permission is granted to the department
  const isPermissionGranted = (permissionId: string) => {
    return departmentPermissions.some(dp => dp.permission.id === permissionId && dp.isGranted);
  };

  // Check if permission is inherited
  const isInherited = (permissionId: string) => {
    return inheritedPermissions.some(ip => ip.permission.id === permissionId);
  };

  // Get permission assignment details
  const getPermissionDetails = (permissionId: string) => {
    const deptPermission = departmentPermissions.find(dp => dp.permission.id === permissionId);
    const inherited = inheritedPermissions.find(ip => ip.permission.id === permissionId);
    return deptPermission || inherited;
  };

  // Handle permission toggle
  const handlePermissionToggle = async (permissionId: string, granted: boolean) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/permissions/${permissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isGranted: granted }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar permiso');
      }

      const result = await response.json();
      toast.success(result.message);
      await fetchPermissions();
      onPermissionsUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar permiso');
    }
  };

  // Handle bulk permission assignment
  const handleBulkAssignment = async () => {
    if (selectedPermissions.length === 0) {
      toast.error('Selecciona al menos un permiso');
      return;
    }

    try {
      const response = await fetch(`/api/departments/${departmentId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionIds: selectedPermissions,
          isGranted: bulkAction === 'grant',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en asignación masiva');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowBulkDialog(false);
      setSelectedPermissions([]);
      await fetchPermissions();
      onPermissionsUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en asignación masiva');
    }
  };

  // Handle permission removal
  const handleRemovePermission = async (permissionId: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/permissions/${permissionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar permiso');
      }

      const result = await response.json();
      toast.success(result.message);
      await fetchPermissions();
      onPermissionsUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar permiso');
    }
  };

  // Handle permission expiration
  const handleSetExpiration = async () => {
    if (!selectedPermissionForExpiration || !expirationDate) {
      toast.error('Selecciona una fecha de expiración');
      return;
    }

    try {
      const response = await fetch(`/api/departments/${departmentId}/permissions/${selectedPermissionForExpiration}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: expirationDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al establecer expiración');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowExpirationDialog(false);
      setSelectedPermissionForExpiration(null);
      setExpirationDate('');
      await fetchPermissions();
      onPermissionsUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al establecer expiración');
    }
  };

  // Get permission type icon
  const getPermissionTypeIcon = (type: string) => {
    const icons = {
      READ: <Eye className="h-4 w-4" />,
      WRITE: <Edit className="h-4 w-4" />,
      DELETE: <Trash2 className="h-4 w-4" />,
      ASSIGN: <UserCheck className="h-4 w-4" />,
      SUPERVISE: <Crown className="h-4 w-4" />,
      EXPORT: <Settings className="h-4 w-4" />,
      IMPORT: <Settings className="h-4 w-4" />,
      MANAGE_USERS: <Users className="h-4 w-4" />,
      MANAGE_DEPARTMENTS: <Building className="h-4 w-4" />,
      SYSTEM_CONFIG: <Settings className="h-4 w-4" />,
      VIEW_REPORTS: <BarChart3 className="h-4 w-4" />,
      APPROVE_DECISIONS: <CheckCircle2 className="h-4 w-4" />,
    };
    return icons[type as keyof typeof icons] || <Key className="h-4 w-4" />;
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
            <Shield className="h-6 w-6" />
            Permisos del Departamento
          </h2>
          <p className="text-muted-foreground">
            {department.name} ({department.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPermissions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {selectedPermissions.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(true)}
            >
              {selectedPermissions.length} seleccionados
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Permisos Directos</p>
                <p className="text-2xl font-bold">{departmentPermissions.length}</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Permisos Heredados</p>
                <p className="text-2xl font-bold">{inheritedPermissions.length}</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Por Roles</p>
                <p className="text-2xl font-bold">{roleBasedPermissions.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Disponibles</p>
                <p className="text-2xl font-bold">{permissions.length}</p>
              </div>
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="direct">Permisos Directos</TabsTrigger>
          <TabsTrigger value="inherited">Permisos Heredados</TabsTrigger>
          <TabsTrigger value="roles">Por Roles</TabsTrigger>
        </TabsList>

        {/* Direct Permissions */}
        <TabsContent value="direct" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Permisos Asignados Directamente
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar permisos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardTitle>
              <CardDescription>
                Permisos asignados específicamente a este departamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(permissionsByType).map(([type, typePermissions]) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      {getPermissionTypeIcon(type)}
                      <h3 className="text-lg font-semibold">{type}</h3>
                      <Badge variant="outline">{typePermissions.length} permisos</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {typePermissions.map((permission) => {
                        const details = getPermissionDetails(permission.id);
                        const isGranted = isPermissionGranted(permission.id);
                        const isInheritedPerm = isInherited(permission.id);
                        const isSelected = selectedPermissions.includes(permission.id);

                        return (
                          <Card key={permission.id} className={isSelected ? 'ring-2 ring-primary' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedPermissions(prev => [...prev, permission.id]);
                                      } else {
                                        setSelectedPermissions(prev => prev.filter(id => id !== permission.id));
                                      }
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{permission.name}</span>
                                      {isInheritedPerm && (
                                        <Badge variant="secondary" className="text-xs">
                                          Heredado
                                        </Badge>
                                      )}
                                      {details?.expiresAt && (
                                        <Badge variant="outline" className="text-xs">
                                          <Clock className="h-3 w-3 mr-1" />
                                          Expira: {new Date(details.expiresAt).toLocaleDateString()}
                                        </Badge>
                                      )}
                                    </div>
                                    {permission.description && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {permission.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {permission.resource && (
                                        <span>Recurso: {permission.resource}</span>
                                      )}
                                      {permission.action && (
                                        <span>Acción: {permission.action}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isInheritedPerm && (
                                    <Switch
                                      checked={isGranted}
                                      onCheckedChange={(checked) => handlePermissionToggle(permission.id, checked)}
                                      disabled={loading}
                                    />
                                  )}
                                  {details && !isInheritedPerm && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedPermissionForExpiration(permission.id);
                                        setShowExpirationDialog(true);
                                      }}
                                    >
                                      <Calendar className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {details && !isInheritedPerm && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemovePermission(permission.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inherited Permissions */}
        <TabsContent value="inherited" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permisos Heredados</CardTitle>
              <CardDescription>
                Permisos heredados de departamentos padres en la jerarquía
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inheritedPermissions.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay permisos heredados</h3>
                  <p className="text-muted-foreground">
                    Este departamento no hereda permisos de departamentos padres
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {inheritedPermissions.map((inheritance, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded">
                              <Building className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{inheritance.permission.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Heredado de departamento padre
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={inheritance.isGranted ? 'default' : 'secondary'}>
                              {inheritance.isGranted ? 'Otorgado' : 'Denegado'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role-based Permissions */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permisos por Roles</CardTitle>
              <CardDescription>
                Permisos disponibles a través de los roles de los usuarios del departamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roleBasedPermissions.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay roles asignados</h3>
                  <p className="text-muted-foreground">
                    No hay usuarios con roles en este departamento
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {roleBasedPermissions.map((role) => (
                    <Card key={role.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5" />
                          {role.name}
                        </CardTitle>
                        <CardDescription>
                          {role.users.length} usuario(s) con este rol
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {role.users.map((user) => (
                              <Badge key={user.id} variant="outline">
                                {user.name}
                              </Badge>
                            ))}
                          </div>

                          {role.permissions && Object.keys(role.permissions).length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Permisos del Rol:</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.entries(role.permissions).map(([key]) => (
                                  <div key={key} className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Assignment Dialog */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'grant' ? 'Otorgar Permisos' : 'Revocar Permisos'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas {bulkAction === 'grant' ? 'otorgar' : 'revocar'} {selectedPermissions.length} permiso(s) al departamento &quot;{department.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAssignment}>
              {bulkAction === 'grant' ? 'Otorgar' : 'Revocar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expiration Dialog */}
      <AlertDialog open={showExpirationDialog} onOpenChange={setShowExpirationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Establecer Fecha de Expiración</AlertDialogTitle>
            <AlertDialogDescription>
              Define cuándo este permiso expirará automáticamente
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="expirationDate">Fecha de Expiración</Label>
              <Input
                id="expirationDate"
                type="datetime-local"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetExpiration}>
              Establecer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

