import {
  Clock,
  AlertCircle,
  CheckCircle,
  PauseCircle,
  XCircle,
  Archive
} from 'lucide-react'

export const CASE_STATUSES = {
  'PENDIENTE': {
    label: 'Pendiente',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800'
  },
  'EN_PROGRESO': {
    label: 'En Progreso',
    icon: AlertCircle,
    color: 'bg-blue-100 text-blue-800'
  },
  'COMPLETADO': {
    label: 'Completado',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800'
  },
  'SUSPENDED': {
    label: 'Suspendido',
    icon: PauseCircle,
    color: 'bg-orange-100 text-orange-800'
  },
  'CANCELLED': {
    label: 'Cancelado',
    icon: XCircle,
    color: 'bg-red-100 text-red-800'
  },
  'ARCHIVED': {
    label: 'Archivado',
    icon: Archive,
    color: 'bg-gray-100 text-gray-800'
  }
} as const

export const PRIORITIES = {
  'LOW': {
    label: 'Baja',
    color: 'bg-gray-100 text-gray-800'
  },
  'MEDIUM': {
    label: 'Media',
    color: 'bg-blue-100 text-blue-800'
  },
  'HIGH': {
    label: 'Alta',
    color: 'bg-orange-100 text-orange-800'
  },
  'URGENT': {
    label: 'Urgente',
    color: 'bg-red-100 text-red-800'
  }
} as const

export const CASE_STAGES = {
  'INITIAL_REVIEW': 'Revisión Inicial',
  'LEGAL_REVIEW': 'Revisión Legal',
  'TECHNICAL_EVALUATION': 'Evaluación Técnica',
  'APPRAISAL': 'Tasación',
  'NEGOTIATION': 'Negociación',
  'DOCUMENTATION': 'Documentación',
  'PUBLIC_CONSULTATION': 'Consulta Pública',
  'APPROVAL': 'Aprobación',
  'PAYMENT': 'Pago',
  'TRANSFER': 'Transferencia',
  'FINAL_CLOSURE': 'Cierre Final',
  'QUALITY_CONTROL': 'Control de Calidad',
  'AUDIT': 'Auditoría',
  'REPORTING': 'Reporte',
  'ARCHIVE_PREPARATION': 'Preparación de Archivo',
  'COMPLETED': 'Completado',
  'SUSPENDED': 'Suspendido',
  'CANCELLED': 'Cancelado'
} as const