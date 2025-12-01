import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { FormField, TextInput, SelectInput, DateInput, NumberInput } from '@/components/forms/form-fields'
import { CASE_STATUSES, CASE_STAGES, PRIORITIES } from '@/constants/case-constants'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

type CaseFormData = CreateCaseInput | UpdateCaseInput

interface BasicInfoSectionProps {
  formData: CaseFormData & {
    status?: string
    progressPercentage?: number
    actualEndDate?: Date
  }
  onInputChange: (field: string, value: any) => void
  mode: 'create' | 'edit'
  generateCaseNumber?: () => Promise<string>
  hasFieldError?: (field: string) => boolean
}

export function BasicInfoSection({
  formData,
  onInputChange,
  mode,
  generateCaseNumber,
  hasFieldError
}: BasicInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Básica del Caso</CardTitle>
        <CardDescription>
          Información general y estado del caso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="fileNumber"
            label="Número de Expediente"
            required={mode === 'create'}
            error={hasFieldError?.('fileNumber') || false}
          >
            <div className="flex gap-2">
              <TextInput
                id="fileNumber"
                value={formData.fileNumber}
                onChange={(value) => onInputChange('fileNumber', value)}
                placeholder={mode === 'create' ? "EXP-2024-10-23-1" : "EXP-2024-001"}
                error={hasFieldError?.('fileNumber') || false}
                required={mode === 'create'}
              />
              {mode === 'create' && generateCaseNumber && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const fileNumber = await generateCaseNumber()
                    onInputChange('fileNumber', fileNumber)
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
          </FormField>

          <FormField
            id="priority"
            label="Prioridad"
          >
            <SelectInput
              id="priority"
              value={formData.priority || 'MEDIUM'}
              onChange={(value) => onInputChange('priority', value)}
              placeholder="Seleccionar prioridad"
              options={PRIORITIES}
            />
          </FormField>
        </div>

        <FormField
          id="title"
          label="Título del Caso"
          required={mode === 'create'}
          error={hasFieldError?.('title') || false}
        >
          <TextInput
            id="title"
            value={formData.title}
            onChange={(value) => onInputChange('title', value)}
            placeholder="Breve descripción del caso"
            error={hasFieldError?.('title') || false}
            required={mode === 'create'}
          />
        </FormField>

        <FormField
          id="description"
          label="Descripción"
        >
          <TextInput
            id="description"
            value={formData.description}
            onChange={(value) => onInputChange('description', value)}
            placeholder="Descripción detallada del caso y circunstancias"
            type="textarea"
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mode === 'edit' && (
            <FormField
              id="status"
              label="Estado"
            >
              <SelectInput
                id="status"
                value={formData.status || 'PENDIENTE'}
                onChange={(value) => onInputChange('status', value)}
                placeholder="Seleccionar estado"
                options={CASE_STATUSES}
              />
            </FormField>
          )}

          <FormField
            id="currentStage"
            label="Etapa Actual"
          >
            <SelectInput
              id="currentStage"
              value={formData.currentStage || 'RECEPCION_SOLICITUD'}
              onChange={(value) => onInputChange('currentStage', value)}
              placeholder="Seleccionar etapa"
              options={CASE_STAGES}
            />
          </FormField>

          {mode === 'edit' && (
            <FormField
              id="progressPercentage"
              label="Progreso (%)"
            >
              <NumberInput
                id="progressPercentage"
                value={formData.progressPercentage}
                onChange={(value) => onInputChange('progressPercentage', value || 0)}
                placeholder="0"
                min={0}
                max={100}
              />
            </FormField>
          )}

          {mode === 'create' && (
            <FormField
              id="expectedEndDate"
              label="Fecha Estimada de Finalización"
            >
              <DateInput
                id="expectedEndDate"
                value={formData.expectedEndDate}
                onChange={(value) => onInputChange('expectedEndDate', value)}
              />
            </FormField>
          )}
        </div>

        {mode === 'edit' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              id="startDate"
              label="Fecha de Inicio"
            >
              <DateInput
                id="startDate"
                value={formData.startDate}
                onChange={(value) => onInputChange('startDate', value)}
              />
            </FormField>

            <FormField
              id="expectedEndDate"
              label="Fecha Estimada de Finalización"
            >
              <DateInput
                id="expectedEndDate"
                value={formData.expectedEndDate}
                onChange={(value) => onInputChange('expectedEndDate', value)}
              />
            </FormField>

            <FormField
              id="actualEndDate"
              label="Fecha Real de Finalización"
            >
              <DateInput
                id="actualEndDate"
                value={formData.actualEndDate}
                onChange={(value) => onInputChange('actualEndDate', value)}
              />
            </FormField>
          </div>
        )}
      </CardContent>
    </Card>
  )
}