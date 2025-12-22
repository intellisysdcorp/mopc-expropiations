/**
 * Centralized Stage Configuration
 * Single source of truth for all case stage properties
 */

import { CaseStage, DocumentType } from '@/generated/prisma/enums'

// Individual stage configuration interface
export interface StageConfig {
  value: CaseStage
  label: string
  description: string
  pendingReason: string
  color: string
  icon: string
  order: number
  documentTypes: DocumentType[]
  estimatedDays: number
  isSpecial?: boolean
}

// Core stage configuration - single source of truth
export const STAGE_CONFIG: Readonly<Record<CaseStage, StageConfig>> = {
  AVALUO: {
    value: 'AVALUO',
    label: 'Avalúo',
    description: 'Confirma existencia de título y evalúa valor de inmueble',
    pendingReason: 'Confirmando título y evaluando valor de inmueble',
    color: '#3b82f6',
    icon: 'Search',
    order: 1,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.OTHER, DocumentType.PHOTOGRAPH, DocumentType.PROPERTY_DOCUMENT],
    estimatedDays: 10,
  },
  REVISION_LEGAL: {
    value: 'REVISION_LEGAL',
    label: 'Revisión Legal',
    description: 'Revisa la legalidad del expediente',
    pendingReason: 'Revisando legalidad del expediente',
    color: '#6366f1',
    icon: 'FileText',
    order: 2,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.OTHER, DocumentType.TECHNICAL_REPORT, DocumentType.PROPERTY_DOCUMENT],
    estimatedDays: 7,
  },
  CUMPLIMIENTO_NORMATIVO: {
    value: 'CUMPLIMIENTO_NORMATIVO',
    label: 'Cumplimiento Normativo',
    description: 'Verifica cumplimiento normativo del expediente',
    pendingReason: 'Verificando cumplimiento normativo',
    color: '#8b5cf6',
    icon: 'CheckCircle',
    order: 3,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.OTHER, DocumentType.PROPERTY_DOCUMENT],
    estimatedDays: 5,
  },
  VALIDACION_TECNICA: {
    value: 'VALIDACION_TECNICA',
    label: 'Validación Técnica',
    description: 'Analiza expediente y validación técnica',
    pendingReason: 'Analizando expediente y validando técnica',
    color: '#a855f7',
    icon: 'BarChart3',
    order: 4,
    documentTypes: [DocumentType.TECHNICAL_REPORT, DocumentType.PROPERTY_DOCUMENT, DocumentType.PHOTOGRAPH],
    estimatedDays: 8,
  },
  VALIDACION_ADMINISTRATIVA: {
    value: 'VALIDACION_ADMINISTRATIVA',
    label: 'Validación Administrativa',
    description: 'Valida aspectos financieros y coordina con departamentos',
    pendingReason: 'Validando aspectos financieros y coordinando',
    color: '#d946ef',
    icon: 'Users',
    order: 5,
    documentTypes: [DocumentType.OTHER, DocumentType.FINANCIAL_RECORD, DocumentType.LEGAL_DOCUMENT],
    estimatedDays: 10,
  },
  SANCION_INICIAL_MINISTRO: {
    value: 'SANCION_INICIAL_MINISTRO',
    label: 'Sanción Inicial de Ministro',
    description: 'Esperando revisión y firma del Ministro',
    pendingReason: 'Esperando revisión y firma del Ministro',
    color: '#ec4899',
    icon: 'Stamp',
    order: 6,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.OTHER, DocumentType.TECHNICAL_REPORT],
    estimatedDays: 5,
  },
  PROGRAMACION_PAGO: {
    value: 'PROGRAMACION_PAGO',
    label: 'Programación de Pago',
    description: 'Programa pago y prepara documentación',
    pendingReason: 'Programando pago y preparando documentación',
    color: '#f43f5e',
    icon: 'Calendar',
    order: 7,
    documentTypes: [DocumentType.FINANCIAL_RECORD, DocumentType.OTHER, DocumentType.PROPERTY_DOCUMENT],
    estimatedDays: 7,
  },
  REVISION_LEGAL_FINAL: {
    value: 'REVISION_LEGAL_FINAL',
    label: 'Revisión Legal Final',
    description: 'Revisa legalidad final y redacta contrato',
    pendingReason: 'Revisando legalidad final y redactando contrato',
    color: '#ef4444',
    icon: 'FileCheck',
    order: 8,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.CONTRACT_DOCUMENT, DocumentType.TECHNICAL_REPORT],
    estimatedDays: 10,
  },
  CERTIFICACION_CONTRATO: {
    value: 'CERTIFICACION_CONTRATO',
    label: 'Certificación de Contrato',
    description: 'Certifica contrato o expediente',
    pendingReason: 'Certificando contrato o expediente',
    color: '#f97316',
    icon: 'Award',
    order: 9,
    documentTypes: [DocumentType.LEGAL_DOCUMENT, DocumentType.CONTRACT_DOCUMENT, DocumentType.PROPERTY_DOCUMENT, DocumentType.OTHER],
    estimatedDays: 15,
  },
  AUTORIZACION_PAGO: {
    value: 'AUTORIZACION_PAGO',
    label: 'Autorización de Pago',
    description: 'Revisa expediente certificado y elabora libramiento',
    pendingReason: 'Revisando expediente certificado y elaborando libramiento',
    color: '#fb923c',
    icon: 'DollarSign',
    order: 10,
    documentTypes: [DocumentType.FINANCIAL_RECORD, DocumentType.OTHER, DocumentType.LEGAL_DOCUMENT],
    estimatedDays: 5,
  },
  REVISION_LIBRAMIENTO: {
    value: 'REVISION_LIBRAMIENTO',
    label: 'Revisión de Libramiento',
    description: 'Revisa y valida libramiento de pago',
    pendingReason: 'Revisando y validando libramiento de pago',
    color: '#fbbf24',
    icon: 'FileSearch',
    order: 11,
    documentTypes: [DocumentType.FINANCIAL_RECORD, DocumentType.OTHER, DocumentType.TECHNICAL_REPORT],
    estimatedDays: 7,
  },
  EMISION_PAGO: {
    value: 'EMISION_PAGO',
    label: 'Emisión de Pago',
    description: 'Emite cheque a beneficiario',
    pendingReason: 'Emitiendo cheque a beneficiario',
    color: '#facc15',
    icon: 'CreditCard',
    order: 12,
    documentTypes: [DocumentType.FINANCIAL_RECORD, DocumentType.OTHER, DocumentType.LEGAL_DOCUMENT],
    estimatedDays: 3,
  },
  ENTREGA_CHEQUE: {
    value: 'ENTREGA_CHEQUE',
    label: 'Entrega de Cheque',
    description: 'Custodia y entrega de cheque',
    pendingReason: 'Custodiando y entregando cheque',
    color: '#84cc16',
    icon: 'CheckCircle2',
    order: 13,
    documentTypes: [DocumentType.OTHER, DocumentType.LEGAL_DOCUMENT, DocumentType.PHOTOGRAPH],
    estimatedDays: 2,
  },
  SUSPENDED: {
    value: 'SUSPENDED',
    label: 'Suspendido',
    description: 'Caso temporalmente suspendido',
    pendingReason: 'Caso suspendido',
    color: '#f59e0b',
    icon: 'Pause',
    order: 999,
    documentTypes: [],
    estimatedDays: 0,
    isSpecial: true,
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelado',
    description: 'Caso cancelado',
    pendingReason: 'Caso cancelado',
    color: '#ef4444',
    icon: 'AlertTriangle',
    order: 1000,
    documentTypes: [],
    estimatedDays: 0,
    isSpecial: true,
  },
} as const

// Derived exports for backward compatibility
// STAGE_ORDER: Main workflow stages in sequence
export const STAGE_ORDER = [
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
] as const satisfies readonly CaseStage[]

// SPECIAL_STAGES: Non-workflow stages
export const SPECIAL_STAGES = ['SUSPENDED', 'CANCELLED'] as const satisfies readonly CaseStage[]

// STAGE_LABELS: Human-readable labels for each stage
export const STAGE_LABELS: Readonly<Record<CaseStage, string>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.label])
) as Readonly<Record<CaseStage, string>>

// STAGE_COLORS: Color codes for UI visualization
export const STAGE_COLORS: Readonly<Record<CaseStage, string>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.color])
) as Readonly<Record<CaseStage, string>>

// STAGE_DOCUMENT_TYPES: Document types allowed per stage
export const STAGE_DOCUMENT_TYPES: Readonly<Record<CaseStage, readonly DocumentType[]>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]): [string, readonly DocumentType[]] => [key, config.documentTypes])
) as Readonly<Record<CaseStage, readonly DocumentType[]>>

// STAGE_DEADLINES: Estimated days for each stage
export const STAGE_DEADLINES: Readonly<Record<CaseStage, number>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.estimatedDays])
) as Readonly<Record<CaseStage, number>>

// STAGE_DESCRIPTIONS: Detailed descriptions for each stage
export const STAGE_DESCRIPTIONS: Readonly<Record<CaseStage, string>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.description])
) as Readonly<Record<CaseStage, string>>

// STAGE_ICONS: Icon names for each stage
export const STAGE_ICONS: Readonly<Record<CaseStage, string>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.icon])
) as Readonly<Record<CaseStage, string>>

// STAGE_PENDING_REASONS: User-facing pending reasons
export const STAGE_PENDING_REASONS: Readonly<Record<CaseStage, string>> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([key, config]) => [key, config.pendingReason])
) as Readonly<Record<CaseStage, string>>

// CASE_STAGES: Array format for existing components (backward compatibility)
export const CASE_STAGES = Object.entries(STAGE_CONFIG).map(
  ([key, config]) => ({ value: key, label: config.label })
)

// Type exports
export type MainWorkflowStage = typeof STAGE_ORDER[number]
export type SpecialStage = typeof SPECIAL_STAGES[number]
