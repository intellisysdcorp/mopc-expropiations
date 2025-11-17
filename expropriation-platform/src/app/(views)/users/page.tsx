'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { UserForm } from '@/components/users/user-form';
import { UserActivityHistory } from '@/components/users/user-activity-history';
import { UserSessions } from '@/components/users/user-sessions';
import { UserPasswordManagement } from '@/components/users/user-password-management';
import { RolePermissionMatrix } from '@/components/users/role-permission-matrix';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Key,
  History,
  Monitor,
  Shield,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  Building,
  Briefcase,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

// Types
interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  isSuspended: boolean;
  lastLoginAt?: string;
  createdAt: string;
  department: { id: string; name: string; code: string };
  role: { id: string; name: string; description: string };
  _count: {
    createdCases: number;
    assignedCases: number;
    supervisedCases: number;
    activities: number;
    documents: number;
  };
}

interface PaginatedUsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: any;
  userCount?: number;
}

export default function UsersManagementPage() {
  const { data: session, status } = useSession();
  const { isSuperAdmin, isDepartmentAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);

  // Form states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRows, setSelectedRows] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});

  // Check authentication and permissions
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      // Check if user has required role based on middleware logic
      if (!isSuperAdmin && !isDepartmentAdmin) {
        toast.error('No tienes permisos para acceder a esta página');
        router.push('/dashboard');
        return;
      }

      loadData();
    }
  }, [status, session, router, isSuperAdmin, isDepartmentAdmin]);

  // Handle URL parameters for automatic dialog opening
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');

      if (action === 'create') {
        setShowCreateDialog(true);
        // Clean the URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (action === 'manage-roles') {
        setShowRolesDialog(true);
        // Clean the URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchDepartments(),
        fetchRoles(),
      ]);
    } catch (error) {
      toast.error('Error al cargar los datos');
      clientLogger.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = 1, limit = 10, search = '', filters = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      ),
    });

    const response = await fetch(`/api/users?${params}`);
    if (!response.ok) {throw new Error('Error fetching users');}

    const data: PaginatedUsersResponse = await response.json();
    setUsers(data.users);
    setPagination(data.pagination);
  };

  const fetchDepartments = async () => {
    const response = await fetch('/api/departments');
    if (!response.ok) {throw new Error('Error fetching departments');}

    const data = await response.json();
    setDepartments(data);
  };

  const fetchRoles = async () => {
    const response = await fetch('/api/roles?includeUserCount=true');
    if (!response.ok) {throw new Error('Error fetching roles');}

    const data = await response.json();
    setRoles(data);
  };

  const handleCreateUser = async (userData: any) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear usuario');
      }

      const newUser = await response.json();
      toast.success('Usuario creado correctamente');
      setShowCreateDialog(false);
      await fetchUsers(pagination.page, pagination.limit, searchTerm, filters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear usuario');
      throw error;
    }
  };

  const handleUpdateUser = async (userData: any) => {
    if (!selectedUser) {return;}

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar usuario');
      }

      const updatedUser = await response.json();
      toast.success('Usuario actualizado correctamente');
      setShowEditDialog(false);
      setSelectedUser(null);
      await fetchUsers(pagination.page, pagination.limit, searchTerm, filters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar usuario');
      throw error;
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {return;}

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar usuario');
      }

      toast.success('Usuario eliminado correctamente');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      await fetchUsers(pagination.page, pagination.limit, searchTerm, filters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar usuario');
    }
  };

  const handleBulkOperation = async (operation: string, data: any = {}) => {
    if (selectedRows.length === 0) {
      toast.error('Selecciona al menos un usuario');
      return;
    }

    try {
      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedRows.map(row => row.id),
          operation,
          data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en operación masiva');
      }

      const result = await response.json();
      toast.success(result.message);
      setSelectedRows([]);
      await fetchUsers(pagination.page, pagination.limit, searchTerm, filters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en operación masiva');
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const response = await fetch(`/api/users/export?${params}`);
      if (!response.ok) {throw new Error('Error al exportar usuarios');}

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usuarios.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Usuarios exportados en formato ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Error al exportar usuarios');
    }
  };

  // Table columns definition
  const columns = [
    {
      id: 'name',
      header: 'Nombre',
      accessorKey: 'firstName' as keyof User,
      cell: (row: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium">
              {row.firstName.charAt(0)}{row.lastName.charAt(0)}
            </span>
          </div>
          <div>
            <div className="font-medium">
              {row.firstName} {row.lastName}
            </div>
            <div className="text-sm text-muted-foreground">
              {row.username}
            </div>
          </div>
        </div>
      ),
      sortable: true,
      filterable: true,
    },
    {
      id: 'email',
      header: 'Correo Electrónico',
      accessorKey: 'email' as keyof User,
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span>{row.email}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
    },
    {
      id: 'phone',
      header: 'Teléfono',
      accessorKey: 'phone' as keyof User,
      cell: (row: User) => (
        row.phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{row.phone}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
    },
    {
      id: 'department',
      header: 'Departamento',
      accessorKey: 'department' as keyof User,
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.department.name}</div>
            <div className="text-sm text-muted-foreground">{row.department.code}</div>
          </div>
        </div>
      ),
      sortable: true,
      filterable: true,
    },
    {
      id: 'role',
      header: 'Rol',
      accessorKey: 'role' as keyof User,
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.role.name}</div>
            {row.role.description && (
              <div className="text-sm text-muted-foreground">{row.role.description}</div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      filterable: true,
    },
    {
      id: 'status',
      header: 'Estado',
      accessorKey: 'isActive' as keyof User,
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          {row.isSuspended ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Suspendido
            </Badge>
          ) : row.isActive ? (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Inactivo
            </Badge>
          )}
        </div>
      ),
      sortable: true,
      filterable: true,
    },
    {
      id: 'lastLogin',
      header: 'Último Login',
      accessorKey: 'lastLoginAt' as keyof User,
      cell: (row: User) => (
        row.lastLoginAt ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(row.lastLoginAt).toLocaleDateString('es-DO')}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Nunca</span>
        )
      ),
      sortable: true,
    },
    {
      id: 'stats',
      header: 'Estadísticas',
      cell: (row: User) => (
        <div className="text-sm">
          <div>Casos: {row._count.createdCases + row._count.assignedCases + row._count.supervisedCases}</div>
          <div>Actividades: {row._count.activities}</div>
        </div>
      ),
    },
  ];

  // Table actions
  const tableActions = [
    {
      label: 'Ver detalles',
      icon: <Eye className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        router.push(`/users/${user.id}`);
      },
    },
    {
      label: 'Editar',
      icon: <Edit className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setShowEditDialog(true);
      },
    },
    {
      label: 'Actividad',
      icon: <History className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setShowActivityDialog(true);
      },
    },
    {
      label: 'Sesiones',
      icon: <Monitor className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setShowSessionsDialog(true);
      },
    },
    {
      label: 'Contraseña',
      icon: <Key className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setShowPasswordDialog(true);
      },
    },
    {
      label: 'Suspender',
      icon: <Lock className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        // Show suspension dialog
        handleBulkOperation('SUSPEND', { suspensionReason: 'Suspensión manual' });
      },
      disabled: (user: User) => user.isSuspended || !user.isActive,
    },
    {
      label: 'Eliminar',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (user: User) => {
        setSelectedUser(user);
        setShowDeleteDialog(true);
      },
      variant: 'destructive' as const,
    },
  ];

  // Bulk actions
  const bulkActions = [
    {
      label: 'Activar',
      icon: <UserCheck className="h-4 w-4" />,
      onClick: (selectedItems: User[]) => handleBulkOperation('ACTIVATE'),
    },
    {
      label: 'Desactivar',
      icon: <UserX className="h-4 w-4" />,
      onClick: (selectedItems: User[]) => handleBulkOperation('DEACTIVATE'),
    },
    {
      label: 'Suspender',
      icon: <Lock className="h-4 w-4" />,
      onClick: (selectedItems: User[]) => {
        // Show suspension reason dialog
        const reason = prompt('Razón de la suspensión:');
        if (reason) {
          handleBulkOperation('SUSPEND', { suspensionReason: reason });
        }
      },
    },
    {
      label: 'Reactivar',
      icon: <Unlock className="h-4 w-4" />,
      onClick: (selectedItems: User[]) => handleBulkOperation('UNSUSPEND'),
    },
    {
      label: 'Forzar cierre de sesión',
      icon: <Monitor className="h-4 w-4" />,
      onClick: (selectedItems: User[]) => handleBulkOperation('FORCE_LOGOUT'),
    },
  ];

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administra los usuarios del sistema y sus permisos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRolesDialog(true)}
          >
            <Shield className="h-4 w-4 mr-2" />
            Gestionar Roles
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.isActive && !u.isSuspended).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Suspendidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.isSuspended).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Inactivos</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {users.filter(u => !u.isActive && !u.isSuspended).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            loading={loading}
            pagination={pagination}
            onPageChange={(page) => {
              setPagination(prev => ({ ...prev, page }));
              fetchUsers(page, pagination.limit, searchTerm, filters);
            }}
            onLimitChange={(limit) => {
              setPagination(prev => ({ ...prev, limit, page: 1 }));
              fetchUsers(1, limit, searchTerm, filters);
            }}
            onSearch={(search) => {
              setSearchTerm(search);
              setPagination(prev => ({ ...prev, page: 1 }));
              fetchUsers(1, pagination.limit, search, filters);
            }}
            onFilter={(newFilters) => {
              setFilters(newFilters);
              setPagination(prev => ({ ...prev, page: 1 }));
              fetchUsers(1, pagination.limit, searchTerm, newFilters);
            }}
            onExport={handleExport}
            onRefresh={() => fetchUsers(pagination.page, pagination.limit, searchTerm, filters)}
            selectedRows={selectedRows}
            onRowSelect={setSelectedRows}
            actions={tableActions}
            bulkActions={bulkActions}
            searchPlaceholder="Buscar usuarios..."
            emptyMessage="No se encontraron usuarios"
          />
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowCreateDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <UserForm
            mode="create"
            departments={departments}
            roles={roles}
            onSubmit={handleCreateUser}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserForm
              mode="edit"
              initialData={selectedUser}
              departments={departments}
              roles={roles}
              onSubmit={handleUpdateUser}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente al usuario "{selectedUser?.firstName} {selectedUser?.lastName}".
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity History Dialog */}
      <Dialog open={showActivityDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Actividad</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserActivityHistory
              userId={selectedUser.id}
              userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={showSessionsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sesiones Activas</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserSessions
              userId={selectedUser.id}
              userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Management Dialog */}
      <Dialog open={showPasswordDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de Contraseña</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserPasswordManagement
              userId={selectedUser.id}
              userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
              userEmail={selectedUser.email}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Roles Management Dialog */}
      <Dialog open={showRolesDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowRolesDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Gestión de Roles y Permisos</DialogTitle>
          </DialogHeader>
          <RolePermissionMatrix
            roles={roles}
            onRolesUpdate={fetchRoles}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}