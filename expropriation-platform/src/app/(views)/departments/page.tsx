'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DepartmentTree } from '@/components/departments/department-tree';
import { DepartmentForm } from '@/components/departments/department-form';
import { DepartmentStatistics } from '@/components/departments/department-statistics';
import { UserTransfer } from '@/components/departments/user-transfer';
import {
  Building,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Users,
  BarChart3,
  ArrowRightLeft,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Department, User } from '@/lib/types/department';
import clientLogger from '@/lib/client-logger';

export default function DepartmentsManagementPage() {
  const { data: session, status } = useSession();
  const { isSuperAdmin, isDepartmentAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | undefined>();
  const [activeTab, setActiveTab] = useState('tree');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // Form states
  const [createParentId, setCreateParentId] = useState<string | undefined>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDepartments(),
        fetchUsers(),
      ]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error('Error al cargar los datos');
        clientLogger.error('Error loading data:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [status, session, router, isSuperAdmin, isDepartmentAdmin, loadData]);

  const fetchDepartments = async () => {
    const response = await fetch('/api/departments?includeHierarchy=true');
    if (!response.ok) {throw new Error('Error fetching departments');}

    const data = await response.json();
    setDepartments(data);
  };

  const fetchUsers = async () => {
    const response = await fetch('/api/users?limit=1000'); // Get all users for department assignment
    if (!response.ok) {throw new Error('Error fetching users');}

    const data = await response.json();
    setUsers(data.users || []);
  };

  const handleCreateDepartment = async (departmentData: any) => {
    try {
      clientLogger.info('Creating department with data:', departmentData);

      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departmentData),
      });

      clientLogger.info('Department creation response status:', { status: response.status });

      if (!response.ok) {
        const error = await response.json();
        clientLogger.error('Department creation error:', error);

        // Provide more specific error messages
        let errorMessage = 'Error al crear departamento';
        if (error.details && Array.isArray(error.details)) {
          errorMessage = error.details.map((detail: any) => detail.message).join(', ');
        } else if (error.error) {
          errorMessage = error.error;
        }

        throw new Error(errorMessage);
      }

      const newDepartment = await response.json();
      clientLogger.info('Department created successfully:', newDepartment);

      toast.success('Departamento creado correctamente');
      setShowCreateDialog(false);
      setCreateParentId(undefined);
      await fetchDepartments();
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Department creation failed:', error);
        const errorMessage = 'Error al crear departamento';
        toast.error(errorMessage);
      }
      throw error;
    }
  };

  const handleUpdateDepartment = async (departmentData: any) => {
    if (!selectedDepartment) {return;}

    try {
      const response = await fetch(`/api/departments/${selectedDepartment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departmentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar departamento');
      }
      
      toast.success('Departamento actualizado correctamente');
      setShowEditDialog(false);
      setSelectedDepartment(undefined);
      await fetchDepartments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar departamento');
      throw error;
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) {return;}

    try {
      const response = await fetch(`/api/departments/${selectedDepartment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar departamento');
      }

      toast.success('Departamento eliminado correctamente');
      setShowDeleteDialog(false);
      setSelectedDepartment(undefined);
      await fetchDepartments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar departamento');
    }
  };

  const handleCreateSubDepartment = (parentId: string) => {
    setCreateParentId(parentId);
    setShowCreateDialog(true);
  };

  const handleRefresh = () => {
    loadData();
  };

  // Calculate statistics
  const stats = {
    total: departments.length,
    active: departments.filter(d => d.isActive).length,
    inactive: departments.filter(d => !d.isActive).length,
    suspended: departments.filter(d => d.isSuspended).length,
    totalUsers: departments.reduce((sum, d) => sum + (d.userCount || 0), 0),
    totalCases: departments.reduce((sum, d) => sum + (d.caseCount || 0), 0),
  };

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
          <h1 className="text-3xl font-bold">Gestión de Departamentos</h1>
          <p className="text-muted-foreground">
            Administra la estructura organizacional y los departamentos del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Departamento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Departamentos</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspendidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Totales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCases}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tree" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Estructura
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="transfer" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transferencias
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        {/* Tree View */}
        <TabsContent value="tree" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Tree */}
            <div className="lg:col-span-2">
              <DepartmentTree
                departments={departments}
                onSelectDepartment={setSelectedDepartment}
                onCreateDepartment={(parentId) => {
                  if (parentId) {
                    handleCreateSubDepartment(parentId);
                  } else {
                    setShowCreateDialog(true);
                  }
                }}
                onEditDepartment={(dept) => {
                  setSelectedDepartment(dept);
                  setShowEditDialog(true);
                }}
                onDeleteDepartment={(dept) => {
                  setSelectedDepartment(dept);
                  setShowDeleteDialog(true);
                }}
                {...(selectedDepartment && { selectedDepartmentId: selectedDepartment.id })}
                loading={loading}
                actions={true}
              />
            </div>

            {/* Department Details */}
            <div>
              {selectedDepartment ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {selectedDepartment.name}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowStatsDialog(true)}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Estadísticas
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowTransferDialog(true)}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Transferir
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {selectedDepartment.code}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Estado</div>
                        <Badge variant={selectedDepartment.isActive ? 'default' : 'secondary'}>
                          {selectedDepartment.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Usuarios</div>
                        <div className="font-medium">{selectedDepartment.userCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Casos</div>
                        <div className="font-medium">{selectedDepartment.caseCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Subdepartamentos</div>
                        <div className="font-medium">{selectedDepartment.childCount}</div>
                      </div>
                    </div>

                    {selectedDepartment.description && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Descripción</div>
                        <p className="text-sm">{selectedDepartment.description}</p>
                      </div>
                    )}

                    {selectedDepartment.headUser && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Jefe del Departamento</div>
                        <div className="text-sm">
                          {selectedDepartment.headUser.firstName} {selectedDepartment.headUser.lastName}
                          <div className="text-muted-foreground">{selectedDepartment.headUser.email}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDepartment(selectedDepartment);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowStatsDialog(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Building className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Selecciona un Departamento</h3>
                      <p className="text-muted-foreground text-sm">
                        Haz clic en un departamento de la estructura para ver sus detalles
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios por Departamento</CardTitle>
              <CardDescription>
                Visualización de todos los usuarios organizados por departamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <span className="font-medium">{dept.name}</span>
                        <Badge variant="outline">{dept.code}</Badge>
                        <Badge variant="secondary">{dept.userCount} usuarios</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDepartment(dept);
                          setShowTransferDialog(true);
                        }}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Transferir Usuarios
                      </Button>
                    </div>
                    {dept.description && (
                      <p className="text-sm text-muted-foreground mb-2">{dept.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer Tab */}
        <TabsContent value="transfer" className="space-y-4">
          {selectedDepartment ? (
            <UserTransfer
              sourceDepartmentId={selectedDepartment.id}
              sourceDepartmentName={selectedDepartment.name}
              users={users.filter(u => u.departmentId === selectedDepartment.id)}
              departments={departments}
              onTransferComplete={() => {
                setShowTransferDialog(false);
                loadData();
              }}
              onCancel={() => setShowTransferDialog(false)}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Selecciona un Departamento</h3>
                  <p className="text-muted-foreground text-sm">
                    Selecciona un departamento de la estructura para transferir usuarios
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Departamentos</CardTitle>
              <CardDescription>
                Configuraciones avanzadas y administración del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Asignación de Etapas</CardTitle>
                      <CardDescription>
                        Configura qué etapas del proceso maneja cada departamento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Asigna las etapas del proceso de expropiación que cada departamento puede gestionar.
                      </p>
                      <Button variant="outline" className="w-full">
                        Configurar Etapas
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Permisos del Departamento</CardTitle>
                      <CardDescription>
                        Gestiona los permisos específicos de cada departamento
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Define permisos personalizados para acciones específicas dentro de cada departamento.
                      </p>
                      <Button variant="outline" className="w-full">
                        Gestionar Permisos
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Historial de Transferencias</CardTitle>
                      <CardDescription>
                        Revisa el historial completo de transferencias de usuarios
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Consulta todas las transferencias realizadas, programadas y su estado actual.
                      </p>
                      <Button variant="outline" className="w-full">
                        Ver Historial
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Reportes y Análisis</CardTitle>
                      <CardDescription>
                        Genera reportes detallados del desempeño departamental
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Crea reportes personalizados sobre el rendimiento y actividad de los departamentos.
                      </p>
                      <Button variant="outline" className="w-full">
                        Generar Reportes
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Department Dialog */}
      <Dialog open={showCreateDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => {
              setShowCreateDialog(false);
              setCreateParentId(undefined);
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>
              {createParentId ? 'Crear Subdepartamento' : 'Crear Nuevo Departamento'}
            </DialogTitle>
          </DialogHeader>
          <DepartmentForm
            mode="create"
            departments={departments}
            users={users}
            onSubmit={handleCreateDepartment}
            onCancel={() => {
              setShowCreateDialog(false);
              setCreateParentId(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => {
              setShowEditDialog(false);
              setSelectedDepartment(undefined);
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Editar Departamento</DialogTitle>
          </DialogHeader>
          {selectedDepartment && (
            <DepartmentForm
              mode="edit"
              initialData={selectedDepartment}
              departments={departments}
              users={users}
              onSubmit={handleUpdateDepartment}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedDepartment(undefined);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Department Dialog */}
      <AlertDialog open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el departamento &quot;{selectedDepartment?.name}&quot;.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDepartment} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Statistics Dialog */}
      <Dialog open={showStatsDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowStatsDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Estadísticas del Departamento</DialogTitle>
          </DialogHeader>
          {selectedDepartment && (
            <DepartmentStatistics departmentId={selectedDepartment.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* User Transfer Dialog */}
      <Dialog open={showTransferDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setShowTransferDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle>Transferencia de Usuarios</DialogTitle>
          </DialogHeader>
          {selectedDepartment && (
            <UserTransfer
              sourceDepartmentId={selectedDepartment.id}
              sourceDepartmentName={selectedDepartment.name}
              users={users.filter(u => u.departmentId === selectedDepartment.id)}
              departments={departments}
              onTransferComplete={() => {
                setShowTransferDialog(false);
                loadData();
              }}
              onCancel={() => setShowTransferDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}