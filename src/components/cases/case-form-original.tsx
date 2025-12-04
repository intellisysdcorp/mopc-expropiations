'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useEnhancedToast } from '@/components/ui/enhanced-toast-provider'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { CreateCaseInput, UpdateCaseInput, Priority, CaseStatus, CaseStage } from '@/lib/validations/case'
import { DepartmentUser, Department, Document, Case } from '@/types/client'
import clientLogger from '@/lib/client-logger'
import { CaseCreationDocuments } from '@/components/cases/case-creation-documents'
import { DocumentUpload } from '@/components/cases/document-upload'
import { DocumentList } from '@/components/cases/document-list'

// Updated enums to match database schema
const CASE_STAGES = [
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

const CASE_STATUSES = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En Progreso' },
  { value: 'COMPLETADO', label: 'Completado' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'ARCHIVED', label: 'Archivado' }
]

const PRIORITIES = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
]

const PROPERTY_TYPES = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'agricola', label: 'Agrícola' },
  { value: 'gubernamental', label: 'Gubernamental' },
  { value: 'terreno', label: 'Terreno Baldío' },
  { value: 'otro', label: 'Otro' }
]

const OWNER_TYPES = [
  { value: 'individual', label: 'Persona Individual' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'gobierno', label: 'Gobierno' },
  { value: 'organizacion', label: 'Organización' },
  { value: 'sucesion', label: 'Sucesión' }
]

interface CaseCreationDocument {
  file: File
  title: string
  description: string
  documentType: string
  category: string
  securityLevel: string
  tags: string
  uploadProgress?: number
  uploadStatus?: 'pending' | 'uploading' | 'complete' | 'error'
  uploadError?: string
  documentId?: string
}

interface CaseFormProps {
  mode: 'create' | 'edit'
  caseId?: string
  initialData?: Case
}

const STEPS = [
  { id: 'basic', title: 'Información Básica', required: ['fileNumber', 'title'] },
  { id: 'property', title: 'Propiedad', required: ['propertyAddress', 'propertyCity', 'propertyProvince'] },
  { id: 'owner', title: 'Propietario', required: ['ownerName'] },
  { id: 'documents', title: 'Documentos', required: [] },
  { id: 'assignment', title: 'Asignación', required: ['departmentId'] }
]

// Edit mode steps with different tabs
const EDIT_STEPS = [
  { id: 'basic', title: 'Información Básica' },
  { id: 'property', title: 'Propiedad' },
  { id: 'owner', title: 'Propietario' },
  { id: 'legal', title: 'Legal y Financiero' },
  { id: 'documents', title: 'Documentos' },
  { id: 'assignment', title: 'Asignación' }
]

/**
 * Use YYYY-MM-DD format which is more reliable for URL params
 * 
 * @param date 
 * @returns date in format YYYY-MM-DD
 */
const formatDate = (date: Date) => date.toISOString().split('T')[0]!

export function CaseForm({ mode, caseId, initialData }: CaseFormProps) {
  const { status } = useSession()
  const router = useRouter()
  const { success, error: showError } = useEnhancedToast()

  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [currentStep, setCurrentStep] = useState(0) // Start at 0 for both modes
  const [showValidationAlert, setShowValidationAlert] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<DepartmentUser[]>([])
  const [existingDocuments, setExistingDocuments] = useState<Document[]>([])
  const [selectedExistingDocuments, setSelectedExistingDocuments] = useState<string[]>([])
  const [documents, setDocuments] = useState<CaseCreationDocument[]>([])
  const [isDraft, setIsDraft] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set())
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [refreshDocuments, setRefreshDocuments] = useState(0)
  const [_assignmentStepAttempted, setAssignmentStepAttempted] = useState(false)
  const [explicitSubmitAttempt, setExplicitSubmitAttempt] = useState(false)

  // Form data state - handles both create and edit modes
  const [formData, setFormData] = useState<CreateCaseInput | UpdateCaseInput>(() => {
    if (mode === 'edit' && initialData) {
      return {
        fileNumber: initialData.fileNumber,
        title: initialData.title,
        description: initialData.description || '',
        priority: initialData.priority as Priority,
        status: initialData.status as CaseStatus,
        currentStage: initialData.currentStage as CaseStage,
        startDate: initialData.startDate ? new Date(initialData.startDate) : undefined,
        expectedEndDate: initialData.expectedEndDate ? new Date(initialData.expectedEndDate) : undefined,
        actualEndDate: initialData.actualEndDate ? new Date(initialData.actualEndDate) : undefined,
        propertyAddress: initialData.propertyAddress,
        propertyCity: initialData.propertyCity,
        propertyProvince: initialData.propertyProvince,
        propertyDescription: initialData.propertyDescription || '',
        propertyCoordinates: initialData.propertyCoordinates || '',
        propertyArea: initialData.propertyArea || undefined,
        propertyType: initialData.propertyType || '',
        ownerName: initialData.ownerName,
        ownerIdentification: initialData.ownerIdentification || '',
        ownerContact: initialData.ownerContact || '',
        ownerEmail: initialData.ownerEmail || '',
        ownerAddress: initialData.ownerAddress || '',
        ownerType: initialData.ownerType || 'individual',
        estimatedValue: initialData.estimatedValue || undefined,
        actualValue: initialData.actualValue || undefined,
        appraisalValue: initialData.appraisalValue || undefined,
        compensationAmount: initialData.compensationAmount || undefined,
        currency: initialData.currency,
        expropriationDecree: initialData.expropriationDecree || '',
        judicialCaseNumber: initialData.judicialCaseNumber || '',
        legalStatus: initialData.legalStatus || '',
        departmentId: initialData.departmentId,
        assignedToId: initialData.assignedToId || 'UNASSIGNED',
        supervisedById: initialData.supervisedById || 'UNASSIGNED',
        progressPercentage: initialData.progressPercentage,
        isDraft: false
      }
    }

    // Default create mode data
    return {
      fileNumber: '',
      title: '',
      description: '',
      priority: 'MEDIUM',
      currentStage: 'RECEPCION_SOLICITUD',
      propertyAddress: '',
      propertyCity: '',
      propertyProvince: '',
      propertyDescription: '',
      propertyType: '',
      propertyArea: undefined,
      propertyCoordinates: '',
      ownerName: '',
      ownerIdentification: '',
      ownerContact: '',
      ownerEmail: '',
      ownerAddress: '',
      ownerType: 'individual',
      estimatedValue: undefined,
      currency: 'DOP',
      expropriationDecree: '',
      judicialCaseNumber: '',
      legalStatus: '',
      departmentId: '',
      assignedToId: 'UNASSIGNED',
      supervisedById: 'UNASSIGNED',
      isDraft: true
    }
  })


  const fetchCase = useCallback(async () => {
    if (!caseId) return

    try {
      const response = await fetch(`/api/cases/${caseId}`)
      if (!response.ok) {
        if (response.status === 404) {
          showError('Caso no encontrado')
          router.push('/cases')
          return
        }
        throw new Error('Failed to fetch case')
      }

      const data: Case = await response.json()
      // Update form data with fetched case data
      setFormData({
        fileNumber: data.fileNumber,
        title: data.title,
        description: data.description || '',
        priority: data.priority as Priority,
        status: data.status as CaseStatus,
        currentStage: data.currentStage as CaseStage,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        expectedEndDate: data.expectedEndDate ? new Date(data.expectedEndDate) : undefined,
        actualEndDate: data.actualEndDate ? new Date(data.actualEndDate) : undefined,
        propertyAddress: data.propertyAddress,
        propertyCity: data.propertyCity,
        propertyProvince: data.propertyProvince,
        propertyDescription: data.propertyDescription || '',
        propertyCoordinates: data.propertyCoordinates || '',
        propertyArea: data.propertyArea || undefined,
        propertyType: data.propertyType || '',
        ownerName: data.ownerName,
        ownerIdentification: data.ownerIdentification || '',
        ownerContact: data.ownerContact || '',
        ownerEmail: data.ownerEmail || '',
        ownerAddress: data.ownerAddress || '',
        ownerType: data.ownerType || 'individual',
        estimatedValue: data.estimatedValue || undefined,
        actualValue: data.actualValue || undefined,
        appraisalValue: data.appraisalValue || undefined,
        compensationAmount: data.compensationAmount || undefined,
        currency: data.currency,
        expropriationDecree: data.expropriationDecree || '',
        judicialCaseNumber: data.judicialCaseNumber || '',
        legalStatus: data.legalStatus || '',
        departmentId: data.departmentId,
        assignedToId: data.assignedToId || 'UNASSIGNED',
        supervisedById: data.supervisedBy?.id || 'UNASSIGNED',
        progressPercentage: data.progressPercentage,
        isDraft: false
      })
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching case:', error)
        showError('Error al cargar los detalles del caso')
      }
      router.push('/cases')
    }
  }, [caseId, router, showError])

  const fetchExistingDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents?limit=50')
      if (response.ok) {
        const data = await response.json()
        setExistingDocuments(data.documents || [])
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching existing documents:', error)
      }
    }
  }, [])

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch('/api/departments')
      if (!response.ok) { throw new Error('Failed to fetch departments') }
      const data = await response.json()
      setDepartments(Array.isArray(data) ? data : (data.departments || []))
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching departments:', error)
        showError('Error al cargar los departamentos')
      }
    }
  }, [showError])

  const fetchDepartmentUsers = useCallback(async (departmentId: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/users`)
      if (!response.ok) { throw new Error('Failed to fetch users') }
      const data = await response.json()
      setUsers(data.users || [])
      // Reset assignments if department changes
      if (mode === 'create') {
        setFormData(prev => ({
          ...prev,
          assignedToId: 'UNASSIGNED',
          supervisedById: 'UNASSIGNED'
        }))
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching users:', error)
        showError('Error al cargar los usuarios del departamento')
      }
    }
  }, [mode, showError])

  // Initialize data and fetch dependencies
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDepartments()
      fetchExistingDocuments()

      if (mode === 'edit' && caseId && !initialData) {
        fetchCase()
      }
    }
  }, [status, mode, caseId, initialData, fetchCase, fetchDepartments, fetchExistingDocuments])

  // Fetch users when department is selected
  useEffect(() => {
    if (formData.departmentId) {
      fetchDepartmentUsers(formData.departmentId)
    }
  }, [formData.departmentId, fetchDepartmentUsers])

  // Generate case number locally as fallback (create mode only)
  const generateCaseNumber = async () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')

    let index = 1
    try {
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const params = new URLSearchParams({
        createdAtFrom: formatDate(today),
        createdAtTo: formatDate(tomorrow),
      })

      const response = await fetch(`/api/cases?${params}`)
      if (response.ok) {
        const data = await response.json()
        clientLogger.info(data);
        // Use the actual cases array length since we're filtering by date
        index = (data.cases?.length || 0) + 1
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Couldn\'t get today\'s case count:', error)
      }
    }
    const indexString = index.toString().padStart(2, '0')
    return `EXP-${year}-${month}-${day}-${indexString}`
  }

  const handleInputChange = (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => {
    // Convert "UNASSIGNED" to undefined for user assignment fields
    if ((field === 'assignedToId' || field === 'supervisedById') && value === 'UNASSIGNED') {
      value = undefined
    }

    // Don't mark assignment step as attempted just for field interactions
    // Only mark it when user actually tries to submit or navigate after filling fields

    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear field error when user changes value
    if (fieldErrors.has(field)) {
      setFieldErrors(prev => {
        const newErrors = new Set(prev)
        newErrors.delete(field)
        return newErrors
      })
      setShowValidationAlert(false)
    }
  }

  const handleStatusChange = (value: CaseStatus) => {
    if (mode === 'edit') {
      setFormData(prev => ({ ...prev, status: value }))
    }
  }

  const handleProgressPercentageChange = (value: string) => {
    if (mode === 'edit') {
      const numValue = value === '' ? undefined : parseFloat(value)
      if (!isNaN(numValue as number)) {
        setFormData(prev => ({ ...prev, progressPercentage: numValue }))
      }
    }
  }

  const handleActualEndDateChange = (value: string) => {
    if (mode === 'edit') {
      setFormData(prev => ({ ...prev, actualEndDate: value ? new Date(value) : undefined }))
    }
  }

  const handleActualValueChange = (value: string) => {
    if (mode === 'edit') {
      const numValue = value === '' ? undefined : parseFloat(value)
      if (!isNaN(numValue as number)) {
        setFormData(prev => ({ ...prev, actualValue: numValue }))
      }
    }
  }

  const handleAppraisalValueChange = (value: string) => {
    if (mode === 'edit') {
      const numValue = value === '' ? undefined : parseFloat(value)
      if (!isNaN(numValue as number)) {
        setFormData(prev => ({ ...prev, appraisalValue: numValue }))
      }
    }
  }

  const handleCompensationAmountChange = (value: string) => {
    if (mode === 'edit') {
      const numValue = value === '' ? undefined : parseFloat(value)
      if (!isNaN(numValue as number)) {
        setFormData(prev => ({ ...prev, compensationAmount: numValue }))
      }
    }
  }

  const handleNumberChange = (field: keyof (CreateCaseInput | UpdateCaseInput), value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    if (!isNaN(numValue as number)) {
      setFormData(prev => ({ ...prev, [field]: numValue }))

      // Clear field error when user starts typing
      if (fieldErrors.has(field)) {
        setFieldErrors(prev => {
          const newErrors = new Set(prev)
          newErrors.delete(field)
          return newErrors
        })
        setShowValidationAlert(false)
      }
    }
  }

  // Helper function to check if a field has an error
  const hasFieldError = (field: string) => {
    return fieldErrors.has(field)
  }

  // Validation function for current step (create mode only)
  const validateCurrentStep = (showErrors = true, context = 'navigation') => {
    if (mode === 'edit') return true // Skip step validation in edit mode

    const step = STEPS[currentStep]

    // Skip validation for assignment step during navigation (only validate on explicit submission)
    if (currentStep === 4 && context === 'navigation') {
      setFieldErrors(new Set())
      setShowValidationAlert(false)
      return true
    }

    const missingFields = step?.required.filter(field => {
      const value = formData[field as keyof CreateCaseInput]
      return !value || (typeof value === 'string' && value.trim() === '')
    })

    if (missingFields && missingFields.length > 0) {
      setFieldErrors(new Set(missingFields))
      // Only show validation alert if errors should be shown AND this is an attempted interaction
      // For assignment step (index 4), ONLY show errors on explicit submission attempt
      if (showErrors && currentStep !== 4) {
        setShowValidationAlert(true)
      }
      // For assignment step, only show if user has explicitly attempted submission
      if (showErrors 
          && currentStep === 4 
          && explicitSubmitAttempt 
          && missingFields.includes('departmentId')
      ) {
        setShowValidationAlert(true)
      }
      return false
    }

    setFieldErrors(new Set())
    setShowValidationAlert(false)
    return true
  }

  // Navigation handlers (create mode only)
  const handleNext = () => {
    if (validateCurrentStep(true, 'navigation')) {
      if (currentStep < STEPS.length - 1) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        setFieldErrors(new Set()) // Clear errors when moving to next step

        // Reset assignment step attempted flag when entering assignment step fresh
        // Also clear validation alert when entering assignment step
        if (nextStep === 4) {
          setAssignmentStepAttempted(false)
          setExplicitSubmitAttempt(false)
          setShowValidationAlert(false)
        }
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      // Reset assignment step attempted flag if leaving the assignment step
      if (currentStep === 4) {
        setAssignmentStepAttempted(false)
        setExplicitSubmitAttempt(false)
      }
    }
    setShowValidationAlert(false)
    setFieldErrors(new Set())
  }

  // Cancel handlers (create mode only)
  const handleCancelClick = () => {
    if (mode === 'create') {
      setShowCancelModal(true)
    } else {
      router.back()
    }
  }

  const handleSaveDraftAndExit = async () => {
    setShowCancelModal(false)
    await saveDraft()
    if (!isDraft) {
      router.push('/cases')
    }
  }

  const handleExitWithoutSaving = () => {
    setShowCancelModal(false)
    router.push('/cases')
  }

  const handleStayInForm = () => {
    setShowCancelModal(false)
  }

  // Handle document upload completion (edit mode)
  const handleDocumentUploadComplete = () => {
    setRefreshDocuments(prev => prev + 1)
    success('Documento subido exitosamente')
  }

  // Handle document selection
  const handleDocumentSelect = (document: Document) => {
    // Could open a detail modal or navigate to document details
    clientLogger.info('Selected document:', document)
  }

  // Check if form has any data entered (for create mode)
  const hasFormData = () => {
    const requiredFields = ['fileNumber', 'title', 'propertyAddress', 'propertyCity', 'propertyProvince', 'ownerName']
    return requiredFields.some(field => {
      const value = formData[field as keyof CreateCaseInput]
      return value && (typeof value === 'string' ? value.trim() !== '' : true)
    }) || documents.length > 0 || selectedExistingDocuments.length > 0
  }

  // Save draft functionality (create mode only)
  const saveDraft = async () => {
    if (mode !== 'create') return

    setSavingDraft(true)
    try {
      const draftData = {
        ...formData,
      }

      const response = await fetch('/api/cases/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save draft')
      }

      const newDraft = await response.json()
      setIsDraft(true)
      success('Borrador guardado exitosamente')
      router.push(`/cases/${newDraft.id}`)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving draft:', error)
        showError(error.message)
      } else {
        showError('Error al guardar el borrador');
      }
    } finally {
      setSavingDraft(false)
    }
  }

  const handleExplicitSubmit = async () => {
    setExplicitSubmitAttempt(true)
    await performSubmit()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Only allow form submission if user explicitly clicked submit
    if (!explicitSubmitAttempt) {
      return
    }

    await performSubmit()
  }

  const performSubmit = async () => {
    // Mark assignment step as attempted since we're submitting
    setAssignmentStepAttempted(true)

    // Validation
    const requiredFields = ['fileNumber', 'title', 'propertyAddress', 'propertyCity', 'propertyProvince', 'ownerName', 'departmentId']
    const missingFields = requiredFields.filter(field => {
      const value = formData[field as keyof CreateCaseInput]
      return !value || (typeof value === 'string' && value.trim() === '')
    })

    if (missingFields.length > 0) {
      setFieldErrors(new Set(missingFields))
      if (mode === 'create') {
        // Switch to the first step with missing fields
        const firstMissingStep = STEPS.findIndex(step =>
          step.required.some(field => missingFields.includes(field))
        )
        if (firstMissingStep !== -1 && firstMissingStep !== currentStep) {
          setCurrentStep(firstMissingStep)
        }
        setShowValidationAlert(true)
      }
      showError('Por favor complete todos los campos requeridos')
      return
    }

    setLoading(true)
    try {
      const submissionData = {
        ...formData,
        isDraft: false,
        // Convert placeholder values back to null for API
        assignedToId: formData.assignedToId === 'UNASSIGNED' ? null : formData.assignedToId,
        supervisedById: formData.supervisedById === 'UNASSIGNED' ? null : formData.supervisedById,
        // Convert empty strings to null for validated optional fields
        propertyCoordinates: formData.propertyCoordinates?.trim() || null,
        ownerIdentification: formData.ownerIdentification?.trim() || null,
        ownerContact: formData.ownerContact?.trim() || null,
        ownerEmail: formData.ownerEmail?.trim() || null,
      }

      let response
      if (mode === 'create') {
        // Create new case
        response = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        })
      } else {
        // Update existing case
        response = await fetch(`/api/cases/${caseId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save case')
      }

      const savedCase = await response.json()

      // Link existing documents (create mode only)
      if (mode === 'create' && selectedExistingDocuments.length > 0) {
        await linkExistingDocuments(savedCase.id)
      }

      // If there are new documents, upload them
      if (documents.length > 0) {
        await uploadDocuments(savedCase.id)
      }

      // Show success toast with case details
      success(
        mode === 'create'
          ? `Caso ${savedCase.fileNumber} creado exitosamente`
          : `Caso ${savedCase.fileNumber} actualizado exitosamente`
      )

      // Small delay before redirect to let user see the toast
      setTimeout(() => {
        router.push(`/cases/${savedCase.id}`)
      }, 500)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving case:', error)
        showError(error.message)
      } else {
        showError('Error al guardar el caso')
      }
    } finally {
      setLoading(false)
      setExplicitSubmitAttempt(false) // Reset the flag after submission
    }
  }

  const linkExistingDocuments = async (caseId: string) => {
    try {
      const linkPromises = selectedExistingDocuments.map(docId =>
        fetch(`/api/cases/${caseId}/documents/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId: docId }),
        })
      )

      await Promise.all(linkPromises)
      success(`${selectedExistingDocuments.length} documento(s) existente(s) vinculado(s)`)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error linking existing documents:', error)
      }
      showError('Error al vincular documentos existentes')
    }
  }

  const uploadDocuments = async (caseId: string) => {
    const uploadPromises = documents.map(async (doc) => {
      try {
        // Update document status to uploading
        setDocuments(prev => prev.map(d =>
          d.file === doc.file ? { ...d, uploadStatus: 'uploading' as const, uploadProgress: 0 } : d
        ))

        const formData = new FormData()
        formData.append('file', doc.file)
        formData.append('documentData', JSON.stringify({
          title: doc.title,
          description: doc.description,
          documentType: doc.documentType,
          category: doc.category,
          securityLevel: doc.securityLevel,
          tags: doc.tags,
          caseId,
        }))

        // Simulate progress
        const progressInterval = setInterval(() => {
          setDocuments(prev => prev.map(d =>
            d.file === doc.file ? {
              ...d,
              uploadProgress: Math.min((d.uploadProgress || 0) + 10, 90)
            } : d
          ))
        }, 200)

        const response = await fetch(`/api/cases/${caseId}/documents`, {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressInterval)

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const document = await response.json()

        // Update document status to complete
        setDocuments(prev => prev.map(d =>
          d.file === doc.file ? {
            ...d,
            uploadStatus: 'complete' as const,
            uploadProgress: 100,
            documentId: document.id
          } : d
        ))

        return document
    } catch (error: unknown) {
      let uploadError = 'Unknown error';
      if (error instanceof Error) {
        clientLogger.error('Upload error:', error)
        uploadError = error.message;
      }

      // Update document status to error
      setDocuments(prev => prev.map(d =>
        d.file === doc.file ? {
          ...d,
          uploadStatus: 'error',
          uploadError
        } : d
      ))

      showError(`Error al subir ${doc.title}`)
      throw error
    }
  })

    try {
      await Promise.all(uploadPromises)
      success(`${documents.length} documento(s) subido(s) exitosamente`)
    } catch (_) {
      showError('Algunos documentos no pudieron ser subidos')
    }
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancelClick}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === 'create' ? 'Crear Nuevo Caso' : 'Editar Caso'}
            </h1>
            <p className="text-muted-foreground">
              {mode === 'create'
                ? 'Complete el formulario paso a paso para crear un nuevo caso de expropiación'
                : `Modifique la información del caso: ${initialData?.fileNumber || caseId}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'create' && isDraft && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Borrador
            </Badge>
          )}
          {mode === 'edit' && (
            <Button
              variant="outline"
              onClick={() => router.push(`/cases/${caseId}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver Caso
            </Button>
          )}
          {mode === 'create' && (
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={loading || savingDraft}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingDraft ? 'Guardando...' : 'Guardar Borrador'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar (create mode only) */}
      {mode === 'create' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Paso {currentStep + 1} de {STEPS.length}</span>
            <span className="text-sm text-muted-foreground">{STEPS[currentStep]?.title}</span>
          </div>
          <Progress value={((currentStep + 1) / STEPS.length) * 100} className="w-full" />
        </div>
      )}

      {/* Validation Alert (create mode only) */}
      {mode === 'create' && showValidationAlert && currentStep !== 4 && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">Campos requeridos faltantes</AlertTitle>
          <AlertDescription className="text-orange-700">
            Por favor complete todos los campos requeridos antes de continuar al siguiente paso.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs
          value={mode === 'create' ? STEPS[currentStep]?.id! : EDIT_STEPS[currentStep]?.id!}
          className="space-y-6"
          onValueChange={(value) => {
            const steps = mode === 'create' ? STEPS : EDIT_STEPS
            const stepIndex = steps.findIndex(step => step.id === value)
            if (stepIndex !== -1) {
              // In create mode, only allow navigation to completed steps or current step
              if (mode === 'create' && stepIndex <= currentStep) {
                setCurrentStep(stepIndex)
                // Clear validation errors when navigating back to previous steps
                setShowValidationAlert(false)
                // Reset assignment step attempted flag if leaving the assignment step
                if (currentStep === 4 && stepIndex !== 4) {
                  setAssignmentStepAttempted(false)
                  setExplicitSubmitAttempt(false)
                }
              } else if (mode === 'edit') {
                setCurrentStep(stepIndex)
              }
            }
          }}
        >
          {mode === 'create' ? (
            <TabsList className="grid w-full grid-cols-5">
              {STEPS.map((step, index) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  disabled={index > currentStep}
                  className={index <= currentStep ? "text-primary" : "text-muted-foreground"}
                >
                  {step.title}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-6">
              {EDIT_STEPS.map((step, index) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className={currentStep === index ? "text-primary" : "text-muted-foreground"}
                >
                  {step.title}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {/* Basic Information Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>Información Básica del Caso</CardTitle>
                <CardDescription>
                  Información general y estado del caso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileNumber" className={hasFieldError('fileNumber') ? 'text-destructive' : ''}>
                      Número de Expediente *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="fileNumber"
                        value={formData.fileNumber || ''}
                        onChange={(e) => handleInputChange('fileNumber', e.target.value)}
                        placeholder={mode === 'create' ? "EXP-2024-10-23-1" : "EXP-2024-001"}
                        required
                      />
                      {mode === 'create' && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            const fileNumber = await generateCaseNumber()
                            setFormData(prev => ({ ...prev, fileNumber }))
                          }}
                          title="Generar número automáticamente"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {mode === 'create' && (
                      <p className="text-sm text-muted-foreground">
                        Puede generar automáticamente o ingresar manualmente
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select
                      value={formData.priority || 'MEDIUM'}
                      onValueChange={(value) => handleInputChange('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar prioridad" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(priority => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className={hasFieldError('title') ? 'text-destructive' : ''}>
                    Título del Caso *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Breve descripción del caso"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Descripción detallada del caso y circunstancias"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {mode === 'edit' && (
                    <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select
                        value={(formData as UpdateCaseInput).status || 'PENDIENTE'}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {CASE_STATUSES.map(status => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="currentStage">Etapa Actual</Label>
                    <Select
                      value={formData.currentStage || 'RECEPCION_SOLICITUD'}
                      onValueChange={(value) => handleInputChange('currentStage', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {CASE_STAGES.map(stage => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mode === 'edit' && (
                    <div className="space-y-2">
                      <Label htmlFor="progressPercentage">Progreso (%)</Label>
                      <Input
                        id="progressPercentage"
                        type="number"
                        min="0"
                        max="100"
                        value={(formData as UpdateCaseInput).progressPercentage || 0}
                        onChange={(e) => handleProgressPercentageChange(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}
                  {mode === 'create' && (
                    <div className="space-y-2">
                      <Label htmlFor="expectedEndDate">Fecha Estimada de Finalización</Label>
                      <Input
                        id="expectedEndDate"
                        type="date"
                        value={formData.expectedEndDate ? new Date(formData.expectedEndDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleInputChange('expectedEndDate', e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </div>
                  )}
                </div>

                {mode === 'edit' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha de Inicio</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleInputChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expectedEndDate">Fecha Estimada de Finalización</Label>
                      <Input
                        id="expectedEndDate"
                        type="date"
                        value={formData.expectedEndDate ? new Date(formData.expectedEndDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleInputChange('expectedEndDate', e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="actualEndDate">Fecha Real de Finalización</Label>
                      <Input
                        id="actualEndDate"
                        type="date"
                        value={(formData as UpdateCaseInput).actualEndDate ? new Date((formData as UpdateCaseInput).actualEndDate!).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleActualEndDateChange(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Property Information Tab */}
          <TabsContent value="property">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Propiedad</CardTitle>
                <CardDescription>
                  Detalles sobre el inmueble a expropiar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="propertyAddress" className={hasFieldError('propertyAddress') ? 'text-destructive' : ''}>
                    Dirección de la Propiedad *
                  </Label>
                  <Input
                    id="propertyAddress"
                    value={formData.propertyAddress || ''}
                    onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                    placeholder="Calle Principal #123, Ciudad"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="propertyCity" className={hasFieldError('propertyCity') ? 'text-destructive' : ''}>
                      Ciudad *
                    </Label>
                    <Input
                      id="propertyCity"
                      value={formData.propertyCity || ''}
                      onChange={(e) => handleInputChange('propertyCity', e.target.value)}
                      placeholder="Santo Domingo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propertyProvince" className={hasFieldError('propertyProvince') ? 'text-destructive' : ''}>
                      Provincia *
                    </Label>
                    <Input
                      id="propertyProvince"
                      value={formData.propertyProvince || ''}
                      onChange={(e) => handleInputChange('propertyProvince', e.target.value)}
                      placeholder="Santo Domingo"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Tipo de Propiedad</Label>
                    <Select
                      value={formData.propertyType || ''}
                      onValueChange={(value) => handleInputChange('propertyType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propertyArea">Área (m²)</Label>
                    <Input
                      id="propertyArea"
                      type="number"
                      step="0.01"
                      value={formData.propertyArea || ''}
                      onChange={(e) => handleNumberChange('propertyArea', e.target.value)}
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="propertyDescription">Descripción de la Propiedad</Label>
                  <Textarea
                    id="propertyDescription"
                    value={formData.propertyDescription || ''}
                    onChange={(e) => handleInputChange('propertyDescription', e.target.value)}
                    placeholder="Descripción detallada de las características de la propiedad"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="propertyCoordinates">Coordenadas GPS</Label>
                  <Input
                    id="propertyCoordinates"
                    value={formData.propertyCoordinates || ''}
                    onChange={(e) => handleInputChange('propertyCoordinates', e.target.value)}
                    placeholder="18.4802,-69.9388"
                  />
                  <p className="text-sm text-muted-foreground">
                    Formato: latitud,longitud (ej: 18.4802,-69.9388)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedValue">Valor Estimado (DOP)</Label>
                  <Input
                    id="estimatedValue"
                    type="number"
                    step="0.01"
                    value={formData.estimatedValue || ''}
                    onChange={(e) => handleNumberChange('estimatedValue', e.target.value)}
                    placeholder="5000000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Valor estimado de la propiedad para fines de expropiación
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Owner Information Tab */}
          <TabsContent value="owner">
            <Card>
              <CardHeader>
                <CardTitle>Información del Propietario</CardTitle>
                <CardDescription>
                  Datos del propietario actual de la propiedad
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName" className={hasFieldError('ownerName') ? 'text-destructive' : ''}>
                      Nombre del Propietario *
                    </Label>
                    <Input
                      id="ownerName"
                      value={formData.ownerName || ''}
                      onChange={(e) => handleInputChange('ownerName', e.target.value)}
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerType">Tipo de Propietario</Label>
                    <Select
                      value={formData.ownerType || 'individual'}
                      onValueChange={(value) => handleInputChange('ownerType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {OWNER_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerIdentification">Identificación</Label>
                    <Input
                      id="ownerIdentification"
                      value={formData.ownerIdentification || ''}
                      onChange={(e) => handleInputChange('ownerIdentification', e.target.value)}
                      placeholder="123-4567890-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerContact">Teléfono</Label>
                    <Input
                      id="ownerContact"
                      value={formData.ownerContact || ''}
                      onChange={(e) => handleInputChange('ownerContact', e.target.value)}
                      placeholder="809-555-0123"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Email</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={formData.ownerEmail || ''}
                    onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                    placeholder="juan.perez@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerAddress">Dirección del Propietario</Label>
                  <Input
                    id="ownerAddress"
                    value={formData.ownerAddress || ''}
                    onChange={(e) => handleInputChange('ownerAddress', e.target.value)}
                    placeholder="Calle Secundaria #456, Ciudad"
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Información Legal</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expropriationDecree">Decreto de Expropiación</Label>
                      <Input
                        id="expropriationDecree"
                        value={formData.expropriationDecree || ''}
                        onChange={(e) => handleInputChange('expropriationDecree', e.target.value)}
                        placeholder="Decreto XXX-2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="judicialCaseNumber">Número de Caso Judicial</Label>
                      <Input
                        id="judicialCaseNumber"
                        value={formData.judicialCaseNumber || ''}
                        onChange={(e) => handleInputChange('judicialCaseNumber', e.target.value)}
                        placeholder="2024-1234"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legalStatus">Estado Legal</Label>
                    <Input
                      id="legalStatus"
                      value={formData.legalStatus || ''}
                      onChange={(e) => handleInputChange('legalStatus', e.target.value)}
                      placeholder="En proceso judicial"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab - Create mode only */}
          {mode === 'create' && (
            <TabsContent value="documents">
              <div className="space-y-6">
                {/* Existing Documents Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Seleccionar Documentos Existentes</CardTitle>
                    <CardDescription>
                      Elija documentos existentes de la plataforma para asociar a este caso
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {existingDocuments.length > 0 ? (
                      <div className="space-y-4 max-h-64 overflow-y-auto">
                        {existingDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <input
                              type="checkbox"
                              id={`doc-${doc.id}`}
                              checked={selectedExistingDocuments.includes(doc.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExistingDocuments(prev => [...prev, doc.id])
                                } else {
                                  setSelectedExistingDocuments(prev => prev.filter(id => id !== doc.id))
                                }
                              }}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <label htmlFor={`doc-${doc.id}`} className="cursor-pointer">
                                <div className="font-medium text-sm">{doc.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {doc.fileName} • {(doc.fileSize / 1024 / 1024).toFixed(2)} MB • {doc.documentType}
                                </div>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        No hay documentos existentes disponibles
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* New Document Upload */}
                <CaseCreationDocuments
                  documents={documents}
                  onDocumentsChange={setDocuments}
                  disabled={loading}
                  maxFiles={10}
                />
              </div>
            </TabsContent>
          )}

          {/* Legal and Financial Tab - Edit mode only */}
          {mode === 'edit' && (
            <TabsContent value="legal">
              <Card>
                <CardHeader>
                  <CardTitle>Información Legal y Financiera</CardTitle>
                  <CardDescription>
                    Detalles legales y financieros del caso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información Legal</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expropriationDecree">Decreto de Expropiación</Label>
                        <Input
                          id="expropriationDecree"
                          value={formData.expropriationDecree || ''}
                          onChange={(e) => handleInputChange('expropriationDecree', e.target.value)}
                          placeholder="Decreto XXX-2024"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="judicialCaseNumber">Número de Caso Judicial</Label>
                        <Input
                          id="judicialCaseNumber"
                          value={formData.judicialCaseNumber || ''}
                          onChange={(e) => handleInputChange('judicialCaseNumber', e.target.value)}
                          placeholder="2024-1234"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="legalStatus">Estado Legal</Label>
                      <Input
                        id="legalStatus"
                        value={formData.legalStatus || ''}
                        onChange={(e) => handleInputChange('legalStatus', e.target.value)}
                        placeholder="En proceso judicial"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Información Financiera</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="estimatedValue">Valor Estimado</Label>
                        <Input
                          id="estimatedValue"
                          type="number"
                          step="0.01"
                          value={formData.estimatedValue || ''}
                          onChange={(e) => handleNumberChange('estimatedValue', e.target.value)}
                          placeholder="5000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="actualValue">Valor Real</Label>
                        <Input
                          id="actualValue"
                          type="number"
                          step="0.01"
                          value={(formData as UpdateCaseInput).actualValue || ''}
                          onChange={(e) => handleActualValueChange(e.target.value)}
                          placeholder="5200000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="appraisalValue">Valor de Tasación</Label>
                        <Input
                          id="appraisalValue"
                          type="number"
                          step="0.01"
                          value={(formData as UpdateCaseInput).appraisalValue || ''}
                          onChange={(e) => handleAppraisalValueChange(e.target.value)}
                          placeholder="5100000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compensationAmount">Monto de Compensación</Label>
                        <Input
                          id="compensationAmount"
                          type="number"
                          step="0.01"
                          value={(formData as UpdateCaseInput).compensationAmount || ''}
                          onChange={(e) => handleCompensationAmountChange(e.target.value)}
                          placeholder="5150000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Moneda</Label>
                      <Select
                        value={formData.currency || 'DOP'}
                        onValueChange={(value) => handleInputChange('currency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar moneda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOP">Pesos Dominicanos (DOP)</SelectItem>
                          <SelectItem value="USD">Dólares Americanos (USD)</SelectItem>
                          <SelectItem value="EUR">Euros (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Documents Tab - Edit mode only */}
          {mode === 'edit' && (
            <TabsContent value="documents">
              <div className="space-y-6">
                {/* Document Upload Section */}
                <DocumentUpload
                  caseId={caseId!}
                  currentStage={formData.currentStage || 'RECEPCION_SOLICITUD'}
                  onUploadComplete={handleDocumentUploadComplete}
                />

                <Separator />

                {/* Document List */}
                <DocumentList
                  caseId={caseId!}
                  onDocumentSelect={handleDocumentSelect}
                  refreshTrigger={refreshDocuments}
                />
              </div>
            </TabsContent>
          )}

          {/* Assignment Tab */}
          <TabsContent value="assignment">
            <Card>
              <CardHeader>
                <CardTitle>Asignación del Caso</CardTitle>
                <CardDescription>
                  Asigne el caso al departamento y personal responsable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="departmentId" className={hasFieldError('departmentId') ? 'text-destructive' : ''}>
                    Departamento *
                  </Label>
                  <Select
                    value={formData.departmentId || ''}
                    onValueChange={(value) => handleInputChange('departmentId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {users.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="assignedToId">Asignado a</Label>
                      <Select
                        value={formData.assignedToId || 'UNASSIGNED'}
                        onValueChange={(value) => handleInputChange('assignedToId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar analista" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                          {users
                            .filter(user => ['ANALYST', 'SUPERVISOR', 'DEPARTMENT_ADMIN'].includes(user.role.name))
                            .map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} - {user.role.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supervisedById">Supervisor</Label>
                      <Select
                        value={formData.supervisedById || 'UNASSIGNED'}
                        onValueChange={(value) => handleInputChange('supervisedById', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNASSIGNED">Sin supervisor</SelectItem>
                          {users
                            .filter(user => ['SUPERVISOR', 'DEPARTMENT_ADMIN'].includes(user.role.name))
                            .map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName} - {user.role.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelClick}
              disabled={loading || savingDraft}
            >
              Cancelar
            </Button>
            {mode === 'create' && (
              <Button
                type="button"
                variant="outline"
                onClick={saveDraft}
                disabled={loading || savingDraft}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingDraft ? 'Guardando...' : 'Guardar Borrador'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === 'create' && currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={loading || savingDraft}
              >
                Anterior
              </Button>
            )}

            {mode === 'create' && currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading || savingDraft}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleExplicitSubmit}
                disabled={loading || savingDraft}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Guardando...' : (mode === 'create' ? 'Crear Caso' : 'Guardar Cambios')}
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Cancel Confirmation Modal (Create mode only) */}
      {mode === 'create' && (
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>¿Está seguro que desea salir?</DialogTitle>
              <DialogDescription className="text-left">
                {hasFormData()
                  ? "Tiene información no guardada en este formulario. ¿Qué desea hacer antes de salir?"
                  : "¿Está seguro que desea cancelar la creación de este caso?"
                }
              </DialogDescription>
            </DialogHeader>

            {hasFormData() && (
              <div className="py-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Si guarda como borrador, podrá continuar más tarde</p>
                  <p>• Si sale sin guardar, toda la información se perderá</p>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
              {hasFormData() ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSaveDraftAndExit}
                    disabled={savingDraft}
                    className="w-full sm:w-auto min-w-[160px]"
                  >
                    {savingDraft ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar como borrador
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleExitWithoutSaving}
                    disabled={savingDraft}
                    className="w-full sm:w-auto min-w-[140px]"
                  >
                    Salir sin guardar
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleStayInForm}
                    disabled={savingDraft}
                    className="w-full sm:w-auto min-w-[150px]"
                  >
                    Continuar editando
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleExitWithoutSaving}
                    className="w-full sm:w-auto min-w-[100px]"
                  >
                    Sí, cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleStayInForm}
                    className="w-full sm:w-auto min-w-[80px]"
                  >
                    Continuar
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}