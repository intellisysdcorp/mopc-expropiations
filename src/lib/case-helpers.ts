import { CASE_STATUSES, PRIORITIES } from '@/constants/case'

/**
 * Get status configuration for a given status
 */
export const getStatusConfig = (status: string) => {
  return CASE_STATUSES[status as keyof typeof CASE_STATUSES] || {
    label: status,
    icon: CASE_STATUSES['PENDIENTE'].icon,
    color: 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get priority configuration for a given priority
 */
export const getPriorityConfig = (priority: string) => {
  return PRIORITIES[priority as keyof typeof PRIORITIES] || {
    label: priority,
    color: 'bg-gray-100 text-gray-800'
  }
}