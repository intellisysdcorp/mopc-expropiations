import { CaseStage } from './validations/case'

// Define the main workflow stage order
export const STAGE_ORDER = [
  'RECEPCION_SOLICITUD',           // 1
  'VERIFICACION_REQUISITOS',       // 2
  'CARGA_DOCUMENTOS',             // 3
  'ASIGNACION_ANALISTA',          // 4
  'ANALISIS_PRELIMINAR',          // 5
  'NOTIFICACION_PROPIETARIO',     // 6
  'PERITAJE_TECNICO',             // 7
  'DETERMINACION_VALOR',          // 8
  'OFERTA_COMPRA',               // 9
  'NEGOCIACION',                 // 10
  'APROBACION_ACUERDO',          // 11
  'ELABORACION_ESCRITURA',        // 12
  'FIRMA_DOCUMENTOS',             // 13
  'REGISTRO_PROPIEDAD',          // 14
  'DESEMBOLSO_PAGO',             // 15
  'ENTREGA_INMUEBLE',            // 16
  'CIERRE_ARCHIVO'               // 17
] as const

// Define special stages that aren't part of the main workflow
export const SPECIAL_STAGES = ['SUSPENDED', 'CANCELLED'] as const

export type MainWorkflowStage = typeof STAGE_ORDER[number]
export type SpecialStage = typeof SPECIAL_STAGES[number]

/**
 * Calculate progress percentage based on stage position
 * Special stages (SUSPENDED, CANCELLED) keep their current progress
 */
export function calculateProgressPercentage(
  stage: CaseStage | string,
  currentProgress?: number
): number {
  // Special stages keep their current progress
  if (SPECIAL_STAGES.includes(stage as SpecialStage)) {
    return currentProgress || 0
  }

  const stageIndex = STAGE_ORDER.indexOf(stage as MainWorkflowStage)

  // If stage not found (shouldn't happen with valid stages), return 0
  if (stageIndex === -1) {
    return 0
  }

  // Calculate percentage: (current position / total positions) * 100
  // This gives us: stage 1 = 0%, stage 17 = 100%
  return Math.round((stageIndex / (STAGE_ORDER.length - 1)) * 100)
}

/**
 * Check if a stage transition is valid based on workflow rules
 */
export function isValidStageTransition(
  fromStage: CaseStage,
  toStage: CaseStage
): { valid: boolean; reason?: string } {
  const toStageIsSpecial = SPECIAL_STAGES.includes(toStage as SpecialStage)
  const fromStageIsSpecial = SPECIAL_STAGES.includes(fromStage as SpecialStage)

  // Always allow transition to special stages
  if (toStageIsSpecial) {
    return { valid: true }
  }

  // Handle transitions from special stages
  if (fromStageIsSpecial) {
    if (fromStage === 'SUSPENDED') {
      // From suspended, only allow forward progression to main workflow stages
      const toStageIndex = STAGE_ORDER.indexOf(toStage as MainWorkflowStage)
      if (toStageIndex === -1 || toStageIndex <= 0) {
        return {
          valid: false,
          reason: 'From suspended stage, can only move forward to main workflow stages'
        }
      }
    } else if (fromStage === 'CANCELLED') {
      // From cancelled, only allow moving back to initial stage
      if (toStage !== 'RECEPCION_SOLICITUD') {
        return {
          valid: false,
          reason: 'Cancelled cases can only be moved back to initial review stage'
        }
      }
    }
    return { valid: true }
  }

  // Handle main workflow stage transitions
  const fromStageIndex = STAGE_ORDER.indexOf(fromStage as MainWorkflowStage)
  const toStageIndex = STAGE_ORDER.indexOf(toStage as MainWorkflowStage)

  if (fromStageIndex === -1 || toStageIndex === -1) {
    return { valid: false, reason: 'Invalid stage' }
  }

  // Allow forward progression
  if (toStageIndex > fromStageIndex) {
    return { valid: true }
  }

  // Allow backward return with justification
  if (toStageIndex < fromStageIndex) {
    return { valid: true }
  }

  // Same stage - not a transition
  return { valid: false, reason: 'Cannot transition to the same stage' }
}

/**
 * Get the next stage in the workflow
 */
export function getNextStage(currentStage: CaseStage): CaseStage | null {
  if (SPECIAL_STAGES.includes(currentStage as SpecialStage)) {
    return null
  }

  const currentIndex = STAGE_ORDER.indexOf(currentStage as MainWorkflowStage)
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null
  }

  return STAGE_ORDER[currentIndex + 1] as CaseStage
}

/**
 * Get previous stages in the workflow
 */
export function getPreviousStages(currentStage: CaseStage): CaseStage[] {
  if (SPECIAL_STAGES.includes(currentStage as SpecialStage)) {
    return []
  }

  const currentIndex = STAGE_ORDER.indexOf(currentStage as MainWorkflowStage)
  if (currentIndex <= 0) {
    return []
  }

  // slice returns readonly array, we need to cast it properly
  return [...STAGE_ORDER.slice(0, currentIndex)] as CaseStage[]
}