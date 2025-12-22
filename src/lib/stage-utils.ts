// Import centralized stage definitions
import { STAGE_ORDER, SPECIAL_STAGES } from '@/constants/stages'
import type { CaseStage } from './validations/case'

// Re-export for backward compatibility
export { STAGE_ORDER, SPECIAL_STAGES } from '@/constants/stages'

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
      if (toStage !== 'AVALUO') {
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

  if (fromStage === 'ENTREGA_CHEQUE') {
    // This prevents moving a completed case back into the main workflow.
    // Transitions to special stages like 'SUSPENDED' are already handled above.
    return { valid: false, reason: 'Completed cases cannot be moved back into the workflow.' };
  }

  // Allow backward return with justification for non-completed cases
  if (toStageIndex < fromStageIndex) {
    return { valid: true };
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