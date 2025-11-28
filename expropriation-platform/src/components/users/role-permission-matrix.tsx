'use client';

import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
  Users,
  FileText,
  Eye,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PERMISSION_CATEGORIES, DEFAULT_PERMISSIONS, normalizePermissions, RolePermissions } from '@/types/permissions';
import clientLogger from '@/lib/client-logger';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Partial<RolePermissions>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

interface RolePermissionMatrixProps {
  roles: Role[];
  onRolesUpdate: () => void;
}

// Helper function to get icon for category
const getCategoryIcon = (categoryId: string) => {
  switch (categoryId) {
    case 'user_management': return <Users className="h-4 w-4" />;
    case 'case_management': return <FileText className="h-4 w-4" />;
    case 'department_management': return <Settings className="h-4 w-4" />;
    case 'system_management': return <Shield className="h-4 w-4" />;
    default: return <Shield className="h-4 w-4" />;
  }
};

export function RolePermissionMatrix({ roles, onRolesUpdate }: RolePermissionMatrixProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

  // Initialize role permissions state
  React.useEffect(() => {
    setRolePermissions(DEFAULT_PERMISSIONS);
  }, []);

  // Handle role selection
  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);

    // Load role permissions using the shared utility
    const currentPermissions = role.permissions as Partial<RolePermissions>;
    const normalizedPermissions = normalizePermissions(currentPermissions);
    setRolePermissions(normalizedPermissions);
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionKey: keyof RolePermissions, checked: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [permissionKey]: checked,
    }));
  };

  // Handle category toggle (select all/deselect all)
  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    const category = PERMISSION_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) {return;}

    const updatedPermissions = { ...rolePermissions };
    category.permissions.forEach(permission => {
      updatedPermissions[permission.key] = checked;
    });
    setRolePermissions(updatedPermissions);
  };

  // Create new role
  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    setLoading(true);
    try {

      // Ensure all permission values are proper booleans
      const cleanedPermissions: Record<string, boolean> = {};

      // Let's manually set all permissions to false for testing
      (Object.keys(rolePermissions) as (keyof RolePermissions)[]).forEach(key => {
        const value = rolePermissions[key];

        // Handle string representations of booleans and actual booleans
        if (typeof value === 'string') {
          cleanedPermissions[key] = value === 'true' || value === '1';
        } else if (typeof value === 'boolean') {
          cleanedPermissions[key] = value;
        } else {
          cleanedPermissions[key] = Boolean(value);
        }
      });

      clientLogger.info('Final cleaned permissions:', cleanedPermissions);

      const requestData: any = {
        name: roleName.trim(),
        permissions: cleanedPermissions,
      };

      // Only include description if it's not empty
      if (roleDescription.trim()) {
        requestData.description = roleDescription.trim();
      }

      clientLogger.info('Final request data:', requestData);

      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear el rol');
      }

      toast.success('Rol creado correctamente');
      setShowCreateDialog(false);
      resetForm();
      onRolesUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear el rol');
    } finally {
      setLoading(false);
    }
  };

  // Update existing role
  const handleUpdateRole = async () => {
    if (!selectedRole || !roleName.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    setLoading(true);
    try {
      // Use the shared utility to normalize permissions
      const normalizedPermissions = normalizePermissions(rolePermissions);

      const requestData: any = {
        id: selectedRole.id,
        name: roleName.trim(),
        permissions: normalizedPermissions,
      };

      // Only include description if it's not empty
      if (roleDescription.trim()) {
        requestData.description = roleDescription.trim();
      }

      const response = await fetch('/api/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el rol');
      }

      toast.success('Rol actualizado correctamente');
      setShowEditDialog(false);
      resetForm();
      setSelectedRole(null);
      onRolesUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el rol');
    } finally {
      setLoading(false);
    }
  };

  // Delete role
  const handleDeleteRole = async () => {
    if (!selectedRole) {return;}

    setLoading(true);
    try {
      const response = await fetch(`/api/roles?id=${selectedRole.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el rol');
      }

      toast.success('Rol eliminado correctamente');
      setShowDeleteDialog(false);
      setSelectedRole(null);
      onRolesUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar el rol');
    } finally {
      setLoading(false);
    }
  };

  // Duplicate role
  const handleDuplicateRole = (role: Role) => {
    setRoleName(`${role.name} (Copia)`);
    setRoleDescription(role.description || '');

    const currentPermissions = role.permissions;
    const updatedPermissions = { ...DEFAULT_PERMISSIONS };

    PERMISSION_CATEGORIES.forEach(category => {
      category.permissions.forEach(permission => {
        const value = currentPermissions[permission.key];
        // Ensure we get a proper boolean value
        if (typeof value === 'boolean') {
          updatedPermissions[permission.key] = value;
        } else if (typeof value === 'string') {
          updatedPermissions[permission.key] = value === 'true' || value === '1';
        } else {
          updatedPermissions[permission.key] = false;
        }
      });
    });

    setRolePermissions(updatedPermissions);
    setShowCreateDialog(true);
  };

  // Reset form
  const resetForm = () => {
    setRoleName('');
    setRoleDescription('');
    setRolePermissions(DEFAULT_PERMISSIONS);
  };

  // Load role data for editing
  const loadRoleForEdit = (role: Role) => {
    setRoleName(role.name);
    setRoleDescription(role.description || '');

    const currentPermissions = role.permissions;
    const updatedPermissions = { ...DEFAULT_PERMISSIONS };

    PERMISSION_CATEGORIES.forEach(category => {
      category.permissions.forEach(permission => {
        const value = currentPermissions[permission.key];
        // Ensure we get a proper boolean value
        if (typeof value === 'boolean') {
          updatedPermissions[permission.key] = value;
        } else if (typeof value === 'string') {
          updatedPermissions[permission.key] = value === 'true' || value === '1';
        } else {
          updatedPermissions[permission.key] = false;
        }
      });
    });

    setRolePermissions(updatedPermissions);
    setSelectedRole(role);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Roles y Permisos</h2>
          <p className="text-muted-foreground">
            Administra los roles del sistema y sus permisos asociados
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Rol
        </Button>
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        <TabsList>
          <TabsTrigger value="matrix">Matriz de Permisos</TabsTrigger>
          <TabsTrigger value="roles">Lista de Roles</TabsTrigger>
          <TabsTrigger value="comparison">Comparación de Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Role List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Roles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRole?.id === role.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleRoleSelect(role)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {role.userCount ?? 0} usuario{(role.userCount ?? 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {role.isActive ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Permission Matrix */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {selectedRole ? `Permisos: ${selectedRole.name}` : 'Selecciona un rol'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <div className="space-y-6">
                    {PERMISSION_CATEGORIES.map((category) => (
                      <div key={category.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category.id)}
                            <h3 className="font-medium">{category.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Todos</Label>
                            <Switch
                              checked={category.permissions.every(p => rolePermissions[p.key])}
                              onCheckedChange={(checked) => handleCategoryToggle(category.id, checked)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {category.permissions.map((permission) => (
                            <div key={permission.key} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{permission.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {permission.description}
                                </div>
                              </div>
                              <Switch
                                checked={rolePermissions[permission.key] || false}
                                onCheckedChange={(checked) => handlePermissionToggle(permission.key, checked)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={() => loadRoleForEdit(selectedRole)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Rol
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDuplicateRole(selectedRole)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={(selectedRole.userCount ?? 0) > 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>

                    {(selectedRole.userCount ?? 0) > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No se puede eliminar este rol porque está asignado a {(selectedRole.userCount ?? 0)} usuario{(selectedRole.userCount ?? 0) !== 1 ? 's' : ''}.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecciona un rol para ver y editar sus permisos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Creación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description || '—'}</TableCell>
                      <TableCell>{role.userCount ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={role.isActive ? 'default' : 'secondary'}>
                          {role.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(role.createdAt).toLocaleDateString('es-DO')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleRoleSelect(role)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Permisos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => loadRoleForEdit(role)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateRole(role)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRole(role);
                                setShowDeleteDialog(true);
                              }}
                              className="text-destructive"
                              disabled={Boolean((role.userCount ?? 0) > 0)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparación de Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2">
                      {getCategoryIcon(category.id)}
                      {category.name}
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Permiso</TableHead>
                            {roles.map((role) => (
                              <TableHead key={role.id} className="text-center">
                                {role.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {category.permissions.map((permission) => (
                            <TableRow key={permission.key}>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-sm">{permission.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </div>
                                </div>
                              </TableCell>
                              {roles.map((role) => {
                                const rolePermissions = role.permissions as Record<string, boolean>;
                                const hasPermission = rolePermissions[permission.key] || false;
                                return (
                                  <TableCell key={role.id} className="text-center">
                                    {hasPermission ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Role Dialog */}
      <Dialog open={showCreateDialog || showEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
              resetForm();
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <div>
              <DialogTitle>
                {showCreateDialog ? 'Crear Nuevo Rol' : 'Editar Rol'}
              </DialogTitle>
              <DialogDescription>
                {showCreateDialog
                  ? 'Configura los permisos para el nuevo rol'
                  : 'Modifica los permisos del rol existente'
                }
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Role Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="roleName">Nombre del Rol *</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ej: Analista Senior"
                />
              </div>
              <div>
                <Label htmlFor="roleDescription">Descripción</Label>
                <Textarea
                  id="roleDescription"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Describe el propósito y responsabilidades de este rol..."
                  rows={3}
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <Label>Permisos del Rol</Label>
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(category.id)}
                      <h4 className="font-medium">{category.name}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Todos</Label>
                      <Switch
                        checked={category.permissions.every(p => rolePermissions[p.key])}
                        onCheckedChange={(checked) => handleCategoryToggle(category.id, checked)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {category.permissions.map((permission) => (
                      <div key={permission.key} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{permission.name}</div>
                        </div>
                        <Switch
                          checked={rolePermissions[permission.key] || false}
                          onCheckedChange={(checked) => handlePermissionToggle(permission.key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={showCreateDialog ? handleCreateRole : handleUpdateRole}
              disabled={loading || !roleName.trim()}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  {showCreateDialog ? 'Creando...' : 'Actualizando...'}
                </div>
              ) : (
                showCreateDialog ? 'Crear Rol' : 'Actualizar Rol'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={showDeleteDialog}>
        <DialogContent>
          <button
            onClick={() => setShowDeleteDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <div>
              <DialogTitle>¿Eliminar Rol?</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar el rol &quot;{selectedRole?.name}&quot;?
                {selectedRole && (selectedRole.userCount ?? 0) > 0 && (
                  <span className="text-destructive font-medium">
                    {' '}Este rol está asignado a {(selectedRole.userCount ?? 0)} usuario{(selectedRole.userCount ?? 0) !== 1 ? 's' : ''} y no puede ser eliminado.
                  </span>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={loading || Boolean(selectedRole && (selectedRole.userCount ?? 0) > 0)}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Eliminando...
                </div>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}