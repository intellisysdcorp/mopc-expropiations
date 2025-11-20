// Case stages for workflow management
export const CASE_STAGES = [
  { value: 'RECEPCION_SOLICITUD', label: 'Recepción de Solicitud' },
  { value: 'VERIFICACION_REQUISITOS', label: 'Verificación de Requisitos' },
  { value: 'CARGA_DOCUMENTOS', label: 'Carga de Documentos' },
  { value: 'ASIGNACION_ANALISTA', label: 'Asignación de Analista' },
  { value: 'ANALISIS_PRELIMINAR', label: 'Análisis Preliminar' },
  { value: 'NOTIFICACION_PROPIETARIO', label: 'Notificación al Propietario' },
  { value: 'PERITAJE_TECNICO', label: 'Peritaje Técnico' },
  { value: 'DETERMINACION_VALOR', label: 'Determinación de Valor' },
  { value: 'OFERTA_COMPRA', label: 'Oferta de Compra' },
  { value: 'NEGOCIACION', label: 'Negociación' },
  { value: 'APROBACION_ACUERDO', label: 'Aprobación de Acuerdo' },
  { value: 'ELABORACION_ESCRITURA', label: 'Elaboración de Escritura' },
  { value: 'FIRMA_DOCUMENTOS', label: 'Firma de Documentos' },
  { value: 'REGISTRO_PROPIEDAD', label: 'Registro de Propiedad' },
  { value: 'DESEMBOLSO_PAGO', label: 'Desembolso y Pago' },
  { value: 'ENTREGA_INMUEBLE', label: 'Entrega del Inmueble' },
  { value: 'CIERRE_ARCHIVO', label: 'Cierre de Archivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' }
]

// Case status options
export const CASE_STATUSES = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En Progreso' },
  { value: 'COMPLETADO', label: 'Completado' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'ARCHIVED', label: 'Archivado' }
]

// Priority levels
export const PRIORITIES = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
]

// Property types
export const PROPERTY_TYPES = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'agricola', label: 'Agrícola' },
  { value: 'gubernamental', label: 'Gubernamental' },
  { value: 'terreno', label: 'Terreno Baldío' },
  { value: 'otro', label: 'Otro' }
]

// Owner types
export const OWNER_TYPES = [
  { value: 'individual', label: 'Persona Individual' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'gobierno', label: 'Gobierno' },
  { value: 'organizacion', label: 'Organización' },
  { value: 'sucesion', label: 'Sucesión' }
]

// Currency options
export const CURRENCIES = [
  { value: 'DOP', label: 'Pesos Dominicanos (DOP)' },
  { value: 'USD', label: 'Dólares Americanos (USD)' },
  { value: 'EUR', label: 'Euros (EUR)' }
]

// Form steps for create mode
export const CREATE_STEPS = [
  { id: 'basic', title: 'Información Básica', required: ['fileNumber', 'title'] },
  { id: 'property', title: 'Propiedad', required: ['propertyAddress', 'propertyCity', 'propertyProvince'] },
  { id: 'owner', title: 'Propietario', required: ['ownerName'] },
  { id: 'documents', title: 'Documentos', required: [] },
  { id: 'assignment', title: 'Asignación', required: ['departmentId'] }
]

// Form steps for edit mode
export const EDIT_STEPS = [
  { id: 'basic', title: 'Información Básica' },
  { id: 'property', title: 'Propiedad' },
  { id: 'owner', title: 'Propietario' },
  { id: 'legal', title: 'Legal y Financiero' },
  { id: 'documents', title: 'Documentos' },
  { id: 'assignment', title: 'Asignación' }
]

// Required fields for validation
export const REQUIRED_FIELDS = [
  'fileNumber',
  'title',
  'propertyAddress',
  'propertyCity',
  'propertyProvince',
  'ownerName',
  'departmentId'
]

// Date formatting utility
export const formatDate = (date: Date): string => {
  if (!date) return ''
  const isoString = date.toISOString()
  const parts = isoString.split('T')
  return parts[0] || ''
}