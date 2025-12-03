import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CreateCaseInput, UpdateCaseInput, Priority, CaseStatus, CaseStage } from '@/lib/validations/case'
import { User, Department, Document, Case } from '@/types/client'
import { formatDate } from '@/constants/case-constants'
import clientLogger from '@/lib/client-logger';

interface CaseFormState {
  loading: boolean
  savingDraft: boolean
  departments: Department[]
  users: User[]
  existingDocuments: Document[]
  selectedExistingDocuments: string[]
  documents: CaseCreationDocument[]
  isDraft: boolean
  fieldErrors: Set<string>
  showValidationAlert: boolean
  showCancelModal: boolean
  refreshDocuments: number
  assignmentStepAttempted: boolean
  explicitSubmitAttempt: boolean
}

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

export function useCaseForm(mode: 'create' | 'edit', caseId?: string, initialData?: Case) {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Form state
  const [state, setState] = useState<CaseFormState>({
    loading: false,
    savingDraft: false,
    departments: [],
    users: [],
    existingDocuments: [],
    selectedExistingDocuments: [],
    documents: [],
    isDraft: false,
    fieldErrors: new Set(),
    showValidationAlert: false,
    showCancelModal: false,
    refreshDocuments: 0,
    assignmentStepAttempted: false,
    explicitSubmitAttempt: false,
  })

  // Form data state
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
        supervisedById: initialData.supervisedBy?.id || 'UNASSIGNED',
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

  // Update state helper
  const updateState = (updates: Partial<CaseFormState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  // API calls
  const fetchCase = useCallback(async () => {
    if (!caseId) {
      return
    }

    try {
      const response = await fetch(`/api/cases/${caseId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Caso no encontrado')
        }
        throw new Error('Failed to fetch case')
      }

      const data: Case = await response.json()
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
        }
      throw error
    }
  }, [caseId])

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch('/api/departments')
      if (!response.ok) {
        throw new Error('Failed to fetch departments')
      }
      const data = await response.json()
      updateState({
        departments: Array.isArray(data) ? data : (data.departments || [])
      })
      } catch (error: unknown) {
        if (error instanceof Error) {
          clientLogger.error('Error fetching departments:', error)
        }
      throw error
    }
  }, [])

  const fetchDepartmentUsers = useCallback(async (departmentId: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/users`)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      updateState({ users: data.users || [] })

      // Reset assignments if department changes and in create mode
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
        }
      throw error
    }
  }, [mode])

  const fetchExistingDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents?limit=50')
      if (response.ok) {
        const data = await response.json()
        updateState({ existingDocuments: data.documents || [] })
      }
      } catch (error: unknown) {
        if (error instanceof Error) {
          clientLogger.error('Error fetching existing documents:', error)
        }
    }
  }, [])

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

      const response = await fetch(`/api/cases?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
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

  // Initialize data
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

  return {
    // State
    state,
    formData,

    // Actions
    updateState,
    setFormData,

    // API methods
    fetchCase,
    fetchDepartments,
    fetchDepartmentUsers,
    fetchExistingDocuments,
    generateCaseNumber,

    // Session
    session,
    status,
    router
  }
}