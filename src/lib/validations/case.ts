import { z } from 'zod'

// Enums for validation
const CaseStatusEnum = z.enum(['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'ARCHIVED', 'SUSPENDED', 'CANCELLED'])
const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
const ExpropriationReasonEnum = z.enum([
  'obra_publica',
  'utilidad_publica',
  'interes_social',
  'desarrollo_urbano',
  'infraestructura',
  'seguridad_nacional',
  'otro'
])
const UrgencyLevelEnum = z.enum(['normal', 'urgente', 'inmediata'])
const CaseStageEnum = z.enum([
  'AVALUO',
  'REVISION_LEGAL',
  'CUMPLIMIENTO_NORMATIVO',
  'VALIDACION_TECNICA',
  'VALIDACION_ADMINISTRATIVA',
  'SANCION_INICIAL_MINISTRO',
  'PROGRAMACION_PAGO',
  'REVISION_LEGAL_FINAL',
  'CERTIFICACION_CONTRATO',
  'AUTORIZACION_PAGO',
  'REVISION_LIBRAMIENTO',
  'EMISION_PAGO',
  'ENTREGA_CHEQUE',
  'SUSPENDED',
  'CANCELLED'
])

// Base case schema
export const CaseSchema = z.object({
  fileNumber: z.string()
    .min(1, 'El número de expediente es requerido')
    .max(50, 'El número de expediente no puede exceder 50 caracteres'),

  title: z.string()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),

  description: z.string()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional(),

  priority: PriorityEnum.default('MEDIUM'),
  status: CaseStatusEnum.default('PENDIENTE'),
  currentStage: CaseStageEnum.default('AVALUO'),

  // Dates
  startDate: z.coerce.date().optional(),
  expectedEndDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),

  // Property Information
  propertyAddress: z.string()
    .min(5, 'La dirección de la propiedad es requerida')
    .max(300, 'La dirección no puede exceder 300 caracteres'),

  propertyCity: z.string()
    .min(2, 'La ciudad es requerida')
    .max(100, 'La ciudad no puede exceder 100 caracteres'),

  propertyProvince: z.string()
    .min(2, 'La provincia es requerida')
    .max(100, 'La provincia no puede exceder 100 caracteres'),

  propertyDescription: z.string()
    .max(1000, 'La descripción de la propiedad no puede exceder 1000 caracteres')
    .optional(),

  propertyCoordinates: z.string()
    .regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, 'Las coordenadas deben estar en formato latitud,longitud')
    .or(z.literal(''))
    .nullable()
    .optional(),

  propertyArea: z.number()
    .positive('El área debe ser un número positivo')
    .max(1000000, 'El área no puede exceder 1,000,000 m²')
    .optional(),

  propertyType: z.string()
    .max(100, 'El tipo de propiedad no puede exceder 100 caracteres')
    .optional(),

  // Owner Information
  ownerName: z.string()
    .min(3, 'El nombre del propietario es requerido')
    .max(200, 'El nombre del propietario no puede exceder 200 caracteres'),

  ownerIdentification: z.string()
    .min(3, 'La identificación del propietario debe tener al menos 3 caracteres')
    .max(50, 'La identificación no puede exceder 50 caracteres')
    .or(z.literal(''))
    .nullable()
    .optional(),

  ownerContact: z.string()
    .regex(/^[+]?[\d\s\-\(\)]+$/, 'El teléfono debe contener solo números y caracteres válidos')
    .or(z.literal(''))
    .nullable()
    .optional(),

  ownerEmail: z.string()
    .email('El email no es válido')
    .or(z.literal(''))
    .nullable()
    .optional(),

  ownerAddress: z.string()
    .max(300, 'La dirección del propietario no puede exceder 300 caracteres')
    .optional(),

  ownerType: z.string()
    .max(50, 'El tipo de propietario no puede exceder 50 caracteres')
    .optional(),

  // Financial Information
  estimatedValue: z.number()
    .nonnegative('El valor estimado debe ser positivo')
    .max(1000000000, 'El valor estimado no puede exceder 1,000,000,000')
    .optional(),

  actualValue: z.number()
    .nonnegative('El valor real debe ser positivo')
    .max(1000000000, 'El valor real no puede exceder 1,000,000,000')
    .optional(),

  appraisalValue: z.number()
    .nonnegative('El valor de tasación debe ser positivo')
    .max(1000000000, 'El valor de tasación no puede exceder 1,000,000,000')
    .optional(),

  compensationAmount: z.number()
    .nonnegative('El monto de compensación debe ser positivo')
    .max(1000000000, 'El monto de compensación no puede exceder 1,000,000,000')
    .optional(),

  currency: z.string()
    .length(3, 'La moneda debe tener 3 caracteres')
    .default('DOP'),

  // Legal Information
  expropriationDecree: z.string()
    .max(100, 'El número de decreto no puede exceder 100 caracteres')
    .optional(),

  judicialCaseNumber: z.string()
    .max(100, 'El número de caso judicial no puede exceder 100 caracteres')
    .optional(),

  legalStatus: z.string()
    .max(100, 'El estado legal no puede exceder 100 caracteres')
    .optional(),

  // Expropriation Details
  expropriationReason: ExpropriationReasonEnum.optional(),
  legalFramework: z.string()
    .max(200, 'El marco legal no puede exceder 200 caracteres')
    .optional(),
  expropriationProject: z.string()
    .max(200, 'El nombre del proyecto no puede exceder 200 caracteres')
    .optional(),
  urgencyLevel: UrgencyLevelEnum.optional(),
  budgetAllocation: z.number()
    .nonnegative('La asignación presupuestaria debe ser positiva')
    .max(10000000000, 'La asignación presupuestaria no puede exceder 10,000,000,000')
    .optional(),
  responsibleDepartment: z.string()
    .max(100, 'El departamento responsable no puede exceder 100 caracteres')
    .optional(),
  expropriationJustification: z.string()
    .max(2000, 'La justificación no puede exceder 2000 caracteres')
    .optional(),
  legalConsiderations: z.string()
    .max(1500, 'Las consideraciones legales no pueden exceder 1500 caracteres')
    .optional(),

  // Relations
  departmentId: z.string()
    .min(1, 'El departamento es requerido'),

  assignedToId: z.string().nullable().optional(),
  supervisedById: z.string().nullable().optional(),

  // Progress
  progressPercentage: z.number()
    .min(0, 'El procentaje debe ser al menos 0')
    .max(100, 'El porcentaje no puede exceder 100')
    .default(0),

  // Draft status
  isDraft: z.boolean().default(true)
})

// Create case schema (subset of CaseSchema for creation)
export const CreateCaseSchema = CaseSchema.pick({
  fileNumber: true,
  title: true,
  description: true,
  priority: true,
  currentStage: true,
  startDate: true,
  propertyAddress: true,
  propertyCity: true,
  propertyProvince: true,
  propertyDescription: true,
  propertyCoordinates: true,
  propertyArea: true,
  propertyType: true,
  ownerName: true,
  ownerIdentification: true,
  ownerContact: true,
  ownerEmail: true,
  ownerAddress: true,
  ownerType: true,
  estimatedValue: true,
  actualValue: true,
  appraisalValue: true,
  compensationAmount: true,
  currency: true,
  expropriationDecree: true,
  judicialCaseNumber: true,
  legalStatus: true,
  expropriationReason: true,
  legalFramework: true,
  expropriationProject: true,
  urgencyLevel: true,
  budgetAllocation: true,
  responsibleDepartment: true,
  expropriationJustification: true,
  legalConsiderations: true,
  departmentId: true,
  assignedToId: true,
  supervisedById: true
}).extend({
  expectedEndDate: z.coerce.date().optional(),
  isDraft: z.boolean().default(true)
})

// Update case schema (partial updates allowed)
export const UpdateCaseSchema = CaseSchema.partial()

// Case status update schema
export const CaseStatusUpdateSchema = z.object({
  status: CaseStatusEnum,
  reason: z.string()
    .min(3, 'La razón debe tener al menos 3 caracteres')
    .max(500, 'La razón no puede exceder 500 caracteres')
    .optional(),
  notes: z.string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional()
})

// Case stage update schema
export const CaseStageUpdateSchema = z.object({
  stage: CaseStageEnum,
  reason: z.string()
    .min(3, 'La razón debe tener al menos 3 caracteres')
    .max(500, 'La razón no puede exceder 500 caracteres')
    .optional(),
  notes: z.string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional()
})

// Case assignment schema
export const CaseAssignmentSchema = z.object({
  assignedToId: z.string()
    .min(1, 'El usuario asignado es requerido'),
  supervisedById: z.string().optional(),
  reason: z.string()
    .min(3, 'La razón debe tener al menos 3 caracteres')
    .max(500, 'La razón no puede exceder 500 caracteres')
    .optional()
})

// Case search and filter schema
export const CaseSearchSchema = z.object({
  query: z.string().optional(),
  status: CaseStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  currentStage: CaseStageEnum.optional(),
  departmentId: z.string().optional(),
  assignedToId: z.string().optional(),
  createdBy: z.string().optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  expectedEndDateFrom: z.coerce.date().optional(),
  expectedEndDateTo: z.coerce.date().optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  ownerName: z.string().optional(),
  propertyAddress: z.string().optional(),
  fileNumber: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'startDate', 'expectedEndDate', 'fileNumber', 'title', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeDrafts: z.boolean().default(false)
})

// Type exports
export type CreateCaseInput = z.infer<typeof CreateCaseSchema>
export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>
export type CaseStatusUpdateInput = z.infer<typeof CaseStatusUpdateSchema>
export type CaseStageUpdateInput = z.infer<typeof CaseStageUpdateSchema>
export type CaseAssignmentInput = z.infer<typeof CaseAssignmentSchema>
export type CaseSearchInput = z.infer<typeof CaseSearchSchema>

// Enum type exports
export type CaseStatus = z.infer<typeof CaseStatusEnum>
export type Priority = z.infer<typeof PriorityEnum>
export type CaseStage = z.infer<typeof CaseStageEnum>
export type ExpropriationReason = z.infer<typeof ExpropriationReasonEnum>
export type UrgencyLevel = z.infer<typeof UrgencyLevelEnum>

// Export enums for use in other files
export { CaseStageEnum }