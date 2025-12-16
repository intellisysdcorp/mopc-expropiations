import {
  DocumentType,
  DocumentCategory,
  DocumentStatus,
  DocumentSecurityLevel
} from '@/prisma/client';

// Spanish translations for Document Types
export const documentTypeTranslations: Record<DocumentType, string> = {
  LEGAL_DOCUMENT: 'Documento Legal',
  TECHNICAL_REPORT: 'Informe Técnico',
  PRESENTATION: 'Presentación',
  OTHER: 'Otro',
  FINANCIAL_RECORD: 'Registro Financiero',
  PROPERTY_DOCUMENT: 'Documento de Propiedad',
  IDENTIFICATION_DOCUMENT: 'Documento de Identificación',
  NOTIFICATION_DOCUMENT: 'Documento de Notificación',
  CONTRACT_DOCUMENT: 'Documento de Contrato',
  PHOTOGRAPH: 'Fotografía',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  SPREADSHEET: 'Hoja de Cálculo'
};

// Spanish translations for Document Categories
export const documentCategoryTranslations: Record<DocumentCategory, string> = {
  CORRESPONDENCE: 'Correspondencia',
  ADMINISTRATIVE: 'Administrativo',
  LEGAL: 'Legal',
  TECHNICAL: 'Técnico',
  FINANCIAL: 'Financiero',
  COMMUNICATION: 'Comunicación',
  PHOTOGRAPHIC: 'Fotográfico',
  MULTIMEDIA: 'Multimedia',
  TEMPLATE: 'Plantilla',
  REFERENCE: 'Referencia',
};

// Spanish translations for Document Statuses
export const documentStatusTranslations: Record<DocumentStatus, string> = {
  DRAFT: 'Borrador',
  UNDER_REVIEW: 'En Revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  ARCHIVED: 'Archivado',
  EXPIRED: 'Vencido',
  PENDING_REVIEW: 'Pendiente de Revisión',
  FINAL: 'Final',
  SUPERSEDED: 'Reemplazado',
};

// Spanish translations for Document Security Levels
export const documentSecurityLevelTranslations: Record<DocumentSecurityLevel, string> = {
  PUBLIC: 'Público',
  INTERNAL: 'Interno',
  CONFIDENTIAL: 'Confidencial',
  SECRET: 'Secreto',
  TOP_SECRET: 'Alto Secreto'
};

// Helper functions to get Spanish translations
export const getDocumentTypeTranslation = (type: DocumentType): string => {
  return documentTypeTranslations[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const getDocumentCategoryTranslation = (category: DocumentCategory): string => {
  return documentCategoryTranslations[category] || category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const getDocumentStatusTranslation = (status: DocumentStatus): string => {
  return documentStatusTranslations[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const getDocumentSecurityLevelTranslation = (level: DocumentSecurityLevel): string => {
  return documentSecurityLevelTranslations[level] || level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};