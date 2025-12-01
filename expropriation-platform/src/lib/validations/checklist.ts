import { z } from 'zod'

// Export case-related enums from case validation file
export { CaseStageEnum } from './case'

// Checklist Item Type enum
export const ChecklistItemTypeEnum = z.enum([
  'DOCUMENT',
  'ACTION',
  'VERIFICATION',
  'APPROVAL',
  'INSPECTION',
  'SIGNATURE',
  'PAYMENT',
  'NOTIFICATION'
])

// Type exports
export type ChecklistItemType = z.infer<typeof ChecklistItemTypeEnum>