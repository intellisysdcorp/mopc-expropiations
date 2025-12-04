import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'
import { CREATE_STEPS, REQUIRED_FIELDS } from '@/constants/case-constants'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  missingFields: string[]
}

export const validateCurrentStep = (
  formData: CreateCaseInput | UpdateCaseInput,
  currentStep: number,
  context: 'navigation' | 'submission' = 'navigation'
): ValidationResult => {
  const step = CREATE_STEPS[currentStep]
  const errors: ValidationError[] = []
  const missingFields: string[] = []

  // Skip validation for assignment step during navigation
  if (currentStep === 4 && context === 'navigation') {
    return { isValid: true, errors: [], missingFields: [] }
  }

  // Check required fields for current step
  step?.required.forEach(field => {
    const value = formData[field as keyof CreateCaseInput]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        field,
        message: `El campo ${getFieldLabel(field)} es requerido`
      })
      missingFields.push(field)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    missingFields
  }
}

export const validateFullForm = (
  formData: CreateCaseInput | UpdateCaseInput
): ValidationResult => {
  const errors: ValidationError[] = []
  const missingFields: string[] = []

  REQUIRED_FIELDS.forEach(field => {
    const value = formData[field as keyof CreateCaseInput]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        field,
        message: `El campo ${getFieldLabel(field)} es requerido`
      })
      missingFields.push(field)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    missingFields
  }
}

export const findStepWithMissingFields = (
  missingFields: string[]
): number => {
  return CREATE_STEPS.findIndex(step =>
    step.required.some(field => missingFields.includes(field))
  )
}

export const hasFieldError = (fieldErrors: Set<string>, field: string): boolean => {
  return fieldErrors.has(field)
}

export const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    fileNumber: 'Número de Expediente',
    title: 'Título del Caso',
    propertyAddress: 'Dirección de la Propiedad',
    propertyCity: 'Ciudad',
    propertyProvince: 'Provincia',
    ownerName: 'Nombre del Propietario',
    departmentId: 'Departamento'
  }
  return labels[field] || field
}

export const clearFieldError = (
  fieldErrors: Set<string>,
  field: string
): Set<string> => {
  const newErrors = new Set(fieldErrors)
  newErrors.delete(field)
  return newErrors
}