'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'
import { Case } from '@/types/client'
import clientLogger from '@/lib/client-logger';

// Refactored components
import { BasicInfoSection } from './form-sections/basic-info-section'
import { PropertyInfoSection } from './form-sections/property-info-section'
import { OwnerInfoSection } from './form-sections/owner-info-section'
import { LegalFinancialSection } from './form-sections/legal-financial-section'
import { AssignmentSection } from './form-sections/assignment-section'

// Import existing components for documents
import { CaseCreationDocuments } from '@/components/cases/case-creation-documents'
import { DocumentUpload } from '@/components/cases/document-upload'
import { DocumentList } from '@/components/cases/document-list'

// Custom hooks
import { useCaseForm } from '@/hooks/use-case-form'
import { useCaseFormNavigation } from '@/hooks/use-case-form-navigation'
import { useDocumentSubmission } from '@/hooks/use-document-submission'
import { useEnhancedToast } from '@/components/notifications/enhanced-toast-provider'

// Constants
import { REQUIRED_FIELDS } from '@/constants/case-constants'

interface CaseFormProps {
  mode: 'create' | 'edit'
  caseId?: string
  initialData?: Case
}

export function CaseForm({ mode, caseId, initialData }: CaseFormProps) {
  const router = useRouter()
  const { success, error: showError } = useEnhancedToast()

  // Custom hooks
  const {
    state: formState,
    formData,
    updateState,
    setFormData,
    generateCaseNumber,
    status,
  } = useCaseForm(mode, caseId, initialData)

  const {
    currentStep,
    fieldErrors,
    showValidationAlert,
    steps,
    handleNext,
    handlePrevious,
    handleTabChange,
    handleFieldChange,
    handleExplicitSubmit,
    validateFullSubmission,
    resetSubmissionFlags
  } = useCaseFormNavigation(mode, formData)

  const {
    documents,
    setDocuments,
    selectedExistingDocuments,
    setSelectedExistingDocuments,
    handleDocumentUpload,
    linkExistingDocuments
  } = useDocumentSubmission()

  // Local state for modals and flags
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Initialize document state from formState
  useEffect(() => {
    setDocuments(formState.documents)
    setSelectedExistingDocuments(formState.selectedExistingDocuments)
  }, [formState.documents, formState.selectedExistingDocuments, setDocuments, setSelectedExistingDocuments])

  // Form handlers
  const handleInputChange = (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => {
    // Convert "UNASSIGNED" to undefined for user assignment fields
    if ((field === 'assignedToId' || field === 'supervisedById') && value === 'UNASSIGNED') {
      value = undefined
    }

    setFormData(prev => ({ ...prev, [field]: value }))
    handleFieldChange(field)
  }

  const handleNumberChange = (field: keyof (CreateCaseInput | UpdateCaseInput), value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    if (!isNaN(numValue as number)) {
      setFormData(prev => ({ ...prev, [field]: numValue }))
      handleFieldChange(field)
    }
  }

  const hasFieldError = (field: string) => fieldErrors.has(field)

  // Cancel handlers
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
    if (!formState.isDraft) {
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

  // Document handlers
  const handleDocumentUploadComplete = () => {
    updateState({ refreshDocuments: formState.refreshDocuments + 1 })
    success('Documento subido exitosamente')
  }

  const handleDocumentSelect = (document: any) => {
    clientLogger.info('Selected document:', document)
  }

  // Check if form has any data entered (for create mode)
  const hasFormData = () => {
    return REQUIRED_FIELDS.some(field => {
      const value = formData[field as keyof CreateCaseInput]
      return value && (typeof value === 'string' ? value.trim() !== '' : true)
    }) || documents.length > 0 || selectedExistingDocuments.length > 0
  }

  // Save draft functionality (create mode only)
  const saveDraft = async () => {
    if (mode !== 'create') return

    setSavingDraft(true)
    try {
      const draftData = { ...formData }

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
      updateState({ isDraft: true })
      success('Borrador guardado exitosamente')
      router.push(`/cases/${newDraft.id}`)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving draft:', error)
        showError(error.message)
      } else {
        showError('Error al guardar el borrador')
      }
    } finally {
      setSavingDraft(false)
    }
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await performSubmit()
  }

  const performSubmit = async () => {
    handleExplicitSubmit()

    const validation = validateFullSubmission()
    if (!validation.isValid) {
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
        response = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        })
      } else {
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

      // Handle documents
      if (mode === 'create' && selectedExistingDocuments.length > 0) {
        await linkExistingDocuments(savedCase.id)
      }

      if (documents.length > 0) {
        const result = await handleDocumentUpload(savedCase.id)
        if (result.success) {
          success(result.message)
        } else {
          showError(result.message)
        }
      }

      success(
        mode === 'create'
          ? `Caso ${savedCase.fileNumber} creado exitosamente`
          : `Caso ${savedCase.fileNumber} actualizado exitosamente`
      )

      setTimeout(() => {
        router.push(`/cases/${savedCase.id}`)
      }, 500)
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving case:', error)
        showError(error.message)
      } else {
        showError('Error al guardar el caso');
      }
    } finally {
      setLoading(false)
      resetSubmissionFlags()
    }
  }

  // Loading states
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
          {mode === 'create' && formState.isDraft && (
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
            <span className="text-sm font-medium">Paso {currentStep + 1} de {steps.length}</span>
            <span className="text-sm text-muted-foreground">{steps[currentStep]!.title}</span>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} className="w-full" />
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
          value={steps[currentStep]!.id}
          className="space-y-6"
          onValueChange={handleTabChange}
        >
          <TabsList className={`grid w-full grid-cols-${mode === 'create' ? 5 : 6}`}>
            {steps.map((step, index) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                disabled={mode === 'create' && index > currentStep}
                className={mode === 'create'
                  ? (index <= currentStep ? "text-primary" : "text-muted-foreground")
                  : (currentStep === index ? "text-primary" : "text-muted-foreground")
                }
              >
                {step.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Form Sections */}
          <TabsContent value="basic">
            <BasicInfoSection
              formData={formData}
              onInputChange={handleInputChange}
              mode={mode}
              generateCaseNumber={generateCaseNumber}
              hasFieldError={hasFieldError}
            />
          </TabsContent>

          <TabsContent value="property">
            <PropertyInfoSection
              formData={formData}
              onInputChange={handleInputChange}
              onNumberChange={handleNumberChange}
              hasFieldError={hasFieldError}
            />
          </TabsContent>

          <TabsContent value="owner">
            <OwnerInfoSection
              formData={formData}
              onInputChange={handleInputChange}
              hasFieldError={hasFieldError}
              includeLegalInfo={mode === 'create'}
            />
          </TabsContent>

          {/* Documents Section */}
          {mode === 'create' && (
            <TabsContent value="documents">
              <div className="space-y-6">
                {/* Existing Documents Selection */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Seleccionar Documentos Existentes</h3>
                  <div className="p-4 border rounded-lg">
                    <p className="text-muted-foreground">
                      Elija documentos existentes de la plataforma para asociar a este caso
                    </p>
                    {/* Document selection logic would go here */}
                  </div>
                </div>

                <Separator />

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

          {/* Legal and Financial Section - Edit mode only */}
          {mode === 'edit' && (
            <TabsContent value="legal">
              <LegalFinancialSection
                formData={formData}
                onInputChange={handleInputChange}
                onNumberChange={handleNumberChange}
              />
            </TabsContent>
          )}

          {/* Documents Section - Edit mode only */}
          {mode === 'edit' && (
            <TabsContent value="documents">
              <div className="space-y-6">
                <DocumentUpload
                  caseId={caseId!}
                  currentStage={formData.currentStage || 'RECEPCION_SOLICITUD'}
                  onUploadComplete={handleDocumentUploadComplete}
                />

                <Separator />

                <DocumentList
                  caseId={caseId!}
                  onDocumentSelect={handleDocumentSelect}
                  refreshTrigger={formState.refreshDocuments}
                />
              </div>
            </TabsContent>
          )}

          {/* Assignment Section */}
          <TabsContent value="assignment">
            <AssignmentSection
              formData={formData}
              onInputChange={handleInputChange}
              departments={formState.departments}
              users={formState.users}
              hasFieldError={hasFieldError}
            />
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

            {mode === 'create' && currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading || savingDraft}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="submit"
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