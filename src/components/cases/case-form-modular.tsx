'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, Eye, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { useEnhancedToast } from '@/components/ui/enhanced-toast-provider'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ErrorBoundary from '@/components/ui/error-boundary'
import { CaseBasicInfo } from './form-sections/case-basic-info'
import { PropertyInfo } from './form-sections/property-info'
import { OwnerInfo } from './form-sections/owner-info'
import { ExpropriationDetails } from './form-sections/expropriation-details'
import { DocumentUpload } from './document-upload'
import { DocumentList } from './document-list'

import { CreateCaseSchema, UpdateCaseSchema, CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'
import { Case } from '@/types/client'

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
  caseData?: Case
  onSave: (data: CreateCaseInput | UpdateCaseInput, documents?: CaseCreationDocument[]) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
  mode?: 'create' | 'edit'
}

export function CaseFormModular({
  caseData,
  onSave,
  onCancel,
  isSubmitting = false,
  mode = 'create'
}: CaseFormProps) {
  const { toast } = useEnhancedToast()

  const [creationDocuments] = useState<CaseCreationDocument[]>([])
  const [isPreview, setIsPreview] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [currentStage, setCurrentStage] = useState('basic')
  const [progress, setProgress] = useState(0)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const startDate = new Date(caseData?.startDate || "");
  // Default form values
  const defaultFormValues = {
    fileNumber: caseData?.fileNumber || '',
    title: caseData?.title || '',
    description: caseData?.description || '',
    priority: (caseData?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
    startDate: startDate.toISOString().split('T')[0],
    propertyAddress: caseData?.propertyAddress || '',
    propertyCity: caseData?.propertyCity || '',
    propertyProvince: caseData?.propertyProvince || '',
    propertyDescription: caseData?.propertyDescription || '',
    propertyCoordinates: caseData?.propertyCoordinates || '',
    propertyArea: caseData?.propertyArea || 1,
    propertyType: caseData?.propertyType || '',
    ownerName: caseData?.ownerName || '',
    ownerIdentification: caseData?.ownerIdentification || '',
    ownerContact: caseData?.ownerContact || '',
    ownerEmail: caseData?.ownerEmail || '',
    ownerAddress: caseData?.ownerAddress || '',
    ownerType: caseData?.ownerType || '',
    estimatedValue: caseData?.estimatedValue,
    currency: caseData?.currency || 'DOP',
    expropriationDecree: caseData?.expropriationDecree || '',
    judicialCaseNumber: caseData?.judicialCaseNumber || '',
    legalStatus: caseData?.legalStatus || '',
    departmentId: caseData?.departmentId || '',
    assignedToId: caseData?.assignedToId,
    supervisedById: caseData?.supervisedById,
    expectedEndDate: caseData?.expectedEndDate ? new Date(caseData.expectedEndDate).toISOString().split('T')[0] : undefined,
    isDraft: caseData?.isDraft ?? true
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    control,
    setValue,
    watch
  } = useForm<any>({
    resolver: zodResolver(mode === 'edit' ? UpdateCaseSchema : CreateCaseSchema),
    defaultValues: defaultFormValues,
    mode: 'onBlur' // Validate on blur for better UX
  })

  
  useEffect(() => {
    // Calculate form completion progress
    const fields = ['fileNumber', 'title', 'description', 'status', 'priority', 'currentStage']
    const completedFields = fields.filter(field => watch(field as any))
    setProgress((completedFields.length / fields.length) * 100)

    // Clear validation alert when user starts fixing errors
    if (submitAttempted && Object.keys(errors).length === 0) {
      setSubmitAttempted(false)
    }
  }, [watch, errors, submitAttempted])

  const stages: Array<{ id: string; label: string; icon: string }> = [
    { id: 'basic', label: 'Información Básica', icon: '📋' },
    { id: 'property', label: 'Propiedad', icon: '🏠' },
    { id: 'owner', label: 'Propietario', icon: '👤' },
    { id: 'expropriation', label: 'Expropiación', icon: '⚖️' },
    { id: 'documents', label: 'Documentos', icon: '📄' }
  ]

  const onSubmit = async (data: any) => {
    try {
      await onSave(data, creationDocuments)
      // Navigation is handled by the parent component's handleSave
      // Only show success message for create mode (edit mode shows its own)
      if (mode === 'create') {
        toast({
          title: 'Caso guardado exitosamente',
          description: `El caso ${data.fileNumber} ha sido creado correctamente.`,
          type: 'success'
        })
      }
      setSubmitAttempted(false) // Reset on successful submission
    } catch (error) {
      toast({
        title: 'Error al guardar el caso',
        description: error instanceof Error ? error.message : 'Ocurrió un error inesperado',
        type: 'error'
      })
      // Don't reset submitAttempted on error - user needs to fix the issues
      // Re-throw to prevent form from clearing on error
      throw error
    }
  }

  const handleSaveClick = () => {
    // Prevent multiple submissions
    if (isSubmittingForm) {
      return
    }

    setIsSubmittingForm(true)
    setSubmitAttempted(true)

    // Trigger form validation and submission
    handleSubmit(onSubmit)().finally(() => {
      setIsSubmittingForm(false)
    }).catch(() => {
      // handleSubmit will catch validation errors
      // Validation alert will show automatically
    })
  }

  const handleSave = () => {
    if (isDirty) {
      setShowSaveDialog(true)
    } else {
      onCancel?.()
    }
  }

  const handleConfirmSave = async () => {
    setShowSaveDialog(false)
    await handleSubmit(onSubmit)()
  }

  // Navigation functions
  const handlePreviousStage = () => {
    const currentIndex = stages.findIndex(s => s.id === currentStage)
    const previousStage = currentIndex > 0 ? stages[currentIndex - 1] : null
    if (previousStage) {
      setCurrentStage(previousStage.id)
    }
  }

  const handleNextStage = () => {
    const currentIndex = stages.findIndex(s => s.id === currentStage)
    const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null
    if (nextStage) {
      setCurrentStage(nextStage.id)
    } else {
      // This is the save case - trigger validation and submit
      setSubmitAttempted(true)
      handleSubmit(onSubmit)().catch(() => {
        // Validation errors will be caught and alert will show
      })
    }
  }

  const getStageProgress = (stageId: string) => {
    switch (stageId) {
      case 'basic':
        const basicFields = ['fileNumber', 'title', 'status', 'priority']
        return basicFields.filter(field => watch(field as any)).length / basicFields.length
      case 'property':
        const propertyFields = ['propertyType', 'propertyAddress', 'propertyCity', 'propertyProvince']
        return propertyFields.filter(field => watch(field as any)).length / propertyFields.length
      case 'owner':
        const ownerFields = ['ownerName', 'ownerType', 'ownerContact']
        return ownerFields.filter(field => watch(field as any)).length / ownerFields.length
      case 'expropriation':
        const expFields = ['expropriationDecree', 'judicialCaseNumber', 'legalStatus']
        return expFields.filter(field => watch(field as any)).length / expFields.length
      case 'documents':
        return creationDocuments.length > 0 ? 1 : 0
      default:
        return 0
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {mode === 'create'
                  ? 'Nuevo Caso de Expropiación'
                  : `Editar Caso: ${caseData?.fileNumber}`}
              </h1>
              <p className="text-muted-foreground">
                Complete la información del caso paso a paso
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setIsPreview(!isPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {isPreview ? 'Editar' : 'Vista Previa'}
            </Button>
            <Button onClick={handleSaveClick} disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Validation Alert - Top of Form */}
        {submitAttempted && Object.keys(errors).length > 0 && (
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <p className="text-orange-800 text-sm font-medium">
                Campos requeridos faltantes
              </p>
            </div>
            <p className="text-orange-700 text-sm mt-1 ml-6">
              Por favor complete todos los campos obligatorios marcados en rojo
              antes de guardar el caso.
            </p>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progreso del formulario</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Content */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveClick();
          }}
          className="space-y-6"
        >
          <Tabs
            value={currentStage}
            onValueChange={setCurrentStage}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              {stages.map((stage) => {
                const stageProgress = getStageProgress(stage.id);
                return (
                  <TabsTrigger
                    key={stage.id}
                    value={stage.id}
                    className="relative flex items-center space-x-2"
                  >
                    <span className="mr-1">{stage.icon}</span>
                    <span className="hidden md:inline">{stage.label}</span>
                    {stageProgress === 1 && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="mt-6">
              <TabsContent value="basic" className="space-y-6">
                <CaseBasicInfo
                  register={register}
                  errors={errors}
                  control={control}
                  setValue={setValue}
                  watch={watch}
                />
              </TabsContent>

              <TabsContent value="property" className="space-y-6">
                <PropertyInfo
                  register={register}
                  errors={errors}
                  control={control}
                  setValue={setValue}
                  watch={watch}
                />
              </TabsContent>

              <TabsContent value="owner" className="space-y-6">
                <OwnerInfo
                  register={register}
                  errors={errors}
                  control={control}
                  setValue={setValue}
                  watch={watch}
                />
              </TabsContent>

              <TabsContent value="expropriation" className="space-y-6">
                <ExpropriationDetails
                  register={register}
                  errors={errors}
                  control={control}
                  setValue={setValue}
                  watch={watch}
                />
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {mode === 'create' ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Para subir documentos, primero guarde el caso básico.
                    </p>
                  </div>
                ) : caseData ? (
                  <>
                    <DocumentUpload
                      caseId={caseData.id}
                      currentStage={caseData.currentStage}
                      maxFiles={20}
                    />
                    <DocumentList caseId={caseData.id} />
                  </>
                ) : null}
              </TabsContent>
            </div>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviousStage}
              disabled={currentStage === 'basic'}
            >
              Anterior
            </Button>

            <Button type="button" onClick={handleNextStage}>
              {currentStage === 'documents' ? 'Guardar' : 'Siguiente'}
            </Button>
          </div>
        </form>

        {/* Save Confirmation Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Guardar cambios?</DialogTitle>
              <DialogDescription>
                {isDirty
                  ? 'Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?'
                  : 'No hay cambios pendientes. ¿Desea continuar?'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancelar
              </Button>
              <Button variant="outline" onClick={onCancel}>
                No guardar
              </Button>
              <Button onClick={handleConfirmSave} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}