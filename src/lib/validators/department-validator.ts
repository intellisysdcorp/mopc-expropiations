import { z } from 'zod';

// Schema for department creation - matches simplified schema
export const departmentSchema = z.object({
  name: z.string().min(5, 'El nombre del departamento debe tener al menos 5 caracteres'),
  code: z.string().min(2, 'El código del departamento debe tener al menos 2 caracteres'),
  parentId: z.string().optional(),
  description: z.string().optional(),
  headUserId: z.string().optional(),
  isActive: z.boolean(),
  email: z.email('Correo electrónico inválido').or(z.literal('')),
});

// Schema for department updates
export const updateDepartmentSchema = departmentSchema.partial();

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;