'use client';

import { Building, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { departmentSchema } from '@/lib/validators/department-validator';
import { Department, User } from '@/lib/types/department';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface DepartmentFormProps {
  mode: 'create' | 'edit';
  initialData?: Department;
  departments?: Department[];
  users?: User[];
  onSubmit: (data: DepartmentFormData) => Promise<void>;
  onCancel: () => void;
}

export function DepartmentForm({
  mode,
  initialData,
  departments = [],
  users = [],
  onSubmit,
  onCancel,
}: DepartmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm<DepartmentFormData>({
    mode: 'onChange', // Enable onChange validation to get immediate feedback
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
      code: '',
      parentId: undefined,
      description: '',
      headUserId: undefined,
      isActive: true,
      email: '',
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        code: initialData.code || '',
        parentId: initialData.parentId || undefined,
        description: initialData.description || '',
        headUserId: initialData.headUserId || undefined,
        isActive: initialData.isActive ?? true,
        email: initialData.email ?? '',
      });
    }
  }, [initialData, reset]);

  const selectedHeadUser = watch('headUserId');
  const isActive = watch('isActive');

  // Helper function to check if a department is a child of another
  const isChildOf = useCallback((potentialChild: Department, parent: Department, allDepartments: Department[]): boolean => {
    if (potentialChild.parentId === parent.id) {
      return true;
    }
    if (potentialChild.parentId) {
      const parentDept = allDepartments.find(dept => dept.id === potentialChild.parentId);
      return parentDept ? isChildOf(parentDept, parent, allDepartments) : false;
    }
    return false;
  }, []);

  // Memoized filtered departments that can be parent (exclude current department and its children)
  const eligibleParentDepartments = useMemo(() => {
    return departments.filter(dept => {
      if (mode === 'edit' && initialData) {
        // Exclude current department and its children
        return dept.id !== initialData.id && !isChildOf(dept, initialData, departments);
      }
      return true;
    });
  }, [departments, mode, initialData, isChildOf]);

  // Memoized filtered users for department head selection (typically only admins and department admins)
  const eligibleHeadUsers = useMemo(() => {
    return users.filter(user => {
      const role = user.role.name.toLowerCase();
      return role.includes('admin') || role.includes('super');
    });
  }, [users]);

  const handleFormSubmit = async (data: DepartmentFormData) => {
    setIsSubmitting(true);
    try {
      // Submit data directly without converting undefined to null
      // The form already handles optional fields correctly
      await onSubmit(data);
      if (mode === 'create') {
        reset();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al procesar el formulario'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSelectedHeadUserName = useCallback(() => {
    if (!selectedHeadUser) {return 'Ninguno';}
    const user = eligibleHeadUsers.find(u => u.id === selectedHeadUser);
    return user ? `${user.firstName} ${user.lastName}` : 'Ninguno';
  }, [selectedHeadUser, eligibleHeadUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Nuevo Departamento' : 'Editar Departamento'}
          </h2>
          <p className="text-muted-foreground">
            {mode === 'create'
              ? 'Complete la información para crear un nuevo departamento'
              : 'Modifique la información del departamento'
            }
          </p>
        </div>
        {mode === 'edit' && (
          <div className="flex items-center space-x-2">
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Información del Departamento
            </CardTitle>
            <CardDescription>
              Complete la información básica del departamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Departamento *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Ej: Recursos Humanos"
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="code">Código del Departamento *</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="Ej: RH001"
                  disabled={isSubmitting}
                />
                {errors.code && (
                  <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descripción del departamento y sus responsabilidades"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentId">Departamento Padre</Label>
                <Select
                  value={watch('parentId') ?? 'none'}
                  onValueChange={(value) => setValue('parentId', value === 'none' ? undefined : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar departamento padre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno (departamento raíz)</SelectItem>
                    {eligibleParentDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="headUserId">Jefe del Departamento</Label>
                <Select
                  value={watch('headUserId') ?? 'none'}
                  onValueChange={(value) => setValue('headUserId', value === 'none' ? undefined : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar jefe">
                      {getSelectedHeadUserName()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {eligibleHeadUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} - {user.role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  {...register('email')}
                  type="email"
                  placeholder="departamento@ejemplo.com"
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={watch('isActive')}
                  onCheckedChange={(checked) => setValue('isActive', checked)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="isActive">Departamento Activo</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || (mode === 'create' ? !isDirty : false)}
          >
            {isSubmitting
              ? mode === 'create' ? 'Creando...' : 'Actualizando...'
              : mode === 'create' ? 'Crear Departamento' : 'Actualizar Departamento'
            }
          </Button>
        </div>
      </form>
    </div>
  );
}

