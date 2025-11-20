'use client';

import { useState, useEffect, useCallback, ReactElement } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building,
  Plus,
  Trash2,
  MoreHorizontal,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  parent?: Department;
  children?: Department[];
  isActive: boolean;
  _count: {
    users: number;
  };
}

interface UserDepartmentAssignment {
  id: string;
  userId: string;
  departmentId: string;
  isPrimary: boolean;
  assignedAt: string;
  assignedBy?: string;
  isActive: boolean;
  department: Department;
}

interface DepartmentAssignmentProps {
  userId: string;
  userName: string;
  currentDepartmentId: string;
  onAssignmentUpdate: () => void;
}

export function DepartmentAssignment({
  userId,
  userName,
  onAssignmentUpdate,
}: DepartmentAssignmentProps) {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<UserDepartmentAssignment[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showChangePrimaryDialog, setShowChangePrimaryDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedAssignment, setSelectedAssignment] = useState<UserDepartmentAssignment | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch('/api/departments?includeHierarchy=true');
      if (!response.ok) {throw new Error('Error fetching departments');}

      const data = await response.json();
      setDepartments(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching departments:', error);
        toast.error('Error al cargar los departamentos');
      }
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/departments`);
      if (!response.ok) {throw new Error('Error fetching assignments');}

      const data = await response.json();
      setAssignments(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching assignments:', error);
        toast.error('Error al cargar las asignaciones');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDepartments();
    fetchAssignments();
  }, [fetchDepartments, fetchAssignments]);

  const getDepartmentTree = (departments: Department[]): Department[] => {
    const departmentMap = new Map<string, Department & { children: Department[] }>();
    const rootDepartments: Department[] = [];

    departments.forEach((dept: Department) => {
      departmentMap.set(dept.id, { ...dept, children: [] });
    });

    departments.forEach((dept: Department) => {
      const department = departmentMap.get(dept.id)!;
      if (dept.parentId) {
        const parent = departmentMap.get(dept.parentId);
        if (parent && parent.children) {
          parent.children.push(department);
        }
      } else {
        rootDepartments.push(department);
      }
    });

    return rootDepartments;
  };

  const renderDepartmentOptions = (departments: Department[], _level = 0): ReactElement[] => {
    const options: ReactElement[] = [];
    const tree = getDepartmentTree(departments);

    const renderTree = (items: Department[], currentLevel = 0) => {
      items.forEach(dept => {
        const indent = '  '.repeat(currentLevel);
        const isDisabled = assignments.some(a => a.departmentId === dept.id);

        options.push(
          <SelectItem key={dept.id} value={dept.id} disabled={isDisabled}>
            {indent}{dept.name} ({dept.code})
          </SelectItem>
        );

        if (dept.children && dept.children.length > 0) {
          renderTree(dept.children, currentLevel + 1);
        }
      });
    };

    renderTree(tree);
    return options;
  };

  const handleAssignDepartment = async () => {
    if (!selectedDepartment) {
      toast.error('Selecciona un departamento');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartment,
          isPrimary: assignments.length === 0, // Make primary if it's the first assignment
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al asignar departamento');
      }

      toast.success('Departamento asignado correctamente');
      setShowAssignDialog(false);
      setSelectedDepartment('');
      await fetchAssignments();
      onAssignmentUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al asignar departamento');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/departments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al remover asignación');
      }

      toast.success('Asignación removida correctamente');
      await fetchAssignments();
      onAssignmentUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al remover asignación');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePrimaryDepartment = async () => {
    if (!selectedAssignment) {return;}

    setUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/departments/${selectedAssignment.id}/primary`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cambiar departamento principal');
      }

      toast.success('Departamento principal actualizado correctamente');
      setShowChangePrimaryDialog(false);
      setSelectedAssignment(null);
      await fetchAssignments();
      onAssignmentUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al cambiar departamento principal');
    } finally {
      setUpdating(false);
    }
  };

  const primaryAssignment = assignments.find(a => a.isPrimary);

  return (
    <div className="space-y-6">
      {/* Current Department */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Departamento Principal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {primaryAssignment ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{primaryAssignment.department.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {primaryAssignment.department.code} • Asignado el {new Date(primaryAssignment.assignedAt).toLocaleDateString('es-DO')}
                  </div>
                </div>
              </div>
              <Badge variant="default">Principal</Badge>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este usuario no tiene un departamento principal asignado.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Additional Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Asignaciones Adicionales
            </span>
            <Button onClick={() => setShowAssignDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Departamento
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay asignaciones adicionales
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{assignment.department.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.department.code} • Asignado el {new Date(assignment.assignedAt).toLocaleDateString('es-DO')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.isPrimary && (
                      <Badge variant="default">Principal</Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {!assignment.isPrimary && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setShowChangePrimaryDialog(true);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Establecer como Principal
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-destructive"
                          disabled={assignment.isPrimary}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover Asignación
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Hierarchy Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Información de Jerarquía
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Alert>
              <Building className="h-4 w-4" />
              <AlertDescription>
                Este usuario puede acceder a casos y recursos de sus departamentos asignados
                y de todos los departamentos hijos en la jerarquía.
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground">
              <p><strong>Nota:</strong> El departamento principal determina los permisos base del usuario,
              mientras que las asignaciones adicionales proporcionan acceso extendido a otros departamentos.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assign Department Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Departamento</DialogTitle>
            <DialogDescription>
              Selecciona un departamento para asignar a {userName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="department">Departamento</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  {renderDepartmentOptions(departments)}
                </SelectContent>
              </Select>
            </div>

            {assignments.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Esta será la asignación principal del usuario.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedDepartment('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignDepartment}
              disabled={updating || !selectedDepartment}
            >
              {updating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Asignando...
                </div>
              ) : (
                'Asignar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Primary Department Dialog */}
      <Dialog open={showChangePrimaryDialog} onOpenChange={setShowChangePrimaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Departamento Principal</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cambiar el departamento principal a {selectedAssignment?.department.name}?
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esto puede afectar los permisos y accesos del usuario en el sistema.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePrimaryDialog(false);
                setSelectedAssignment(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePrimaryDepartment}
              disabled={updating}
            >
              {updating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Cambiando...
                </div>
              ) : (
                'Cambiar Principal'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}