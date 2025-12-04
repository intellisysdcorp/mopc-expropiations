'use client'

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateCaseInput } from '@/lib/validations/case'

interface ExpropriationDetailsProps {
  register: UseFormRegister<CreateCaseInput>
  errors: FieldErrors<CreateCaseInput>
  setValue: UseFormSetValue<CreateCaseInput>
  watch: UseFormWatch<CreateCaseInput>
}

const EXPROPRIATION_REASONS = [
  { value: 'obra_publica', label: 'Obra Pública' },
  { value: 'utilidad_publica', label: 'Utilidad Pública' },
  { value: 'interes_social', label: 'Interés Social' },
  { value: 'desarrollo_urbano', label: 'Desarrollo Urbano' },
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'seguridad_nacional', label: 'Seguridad Nacional' },
  { value: 'otro', label: 'Otro' }
]

export function ExpropriationDetails({ register, errors, setValue, watch }: ExpropriationDetailsProps) {
  type ExpropriationReasonType = 'obra_publica' | 'utilidad_publica' | 'interes_social' | 'desarrollo_urbano' | 'infraestructura' | 'seguridad_nacional' | 'otro'
  type UrgencyLevelType = 'normal' | 'urgente' | 'inmediata'

  const handleExpropriationReasonChange = (value: ExpropriationReasonType) => {
    setValue('expropriationReason', value)
  }

  const handleUrgencyLevelChange = (value: UrgencyLevelType) => {
    setValue('urgencyLevel', value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles de la Expropiación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expropriationReason">Motivo de Expropiación</Label>
            <Select onValueChange={handleExpropriationReasonChange} defaultValue={watch('expropriationReason') || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {EXPROPRIATION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.expropriationReason && (
              <p className="text-sm text-red-600">{errors.expropriationReason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalFramework">Marco Legal</Label>
            <Input
              id="legalFramework"
              {...register('legalFramework')}
              placeholder="Ley o decreto que autoriza"
            />
            {errors.legalFramework && (
              <p className="text-sm text-red-600">{errors.legalFramework.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expropriationProject">Proyecto Asociado</Label>
            <Input
              id="expropriationProject"
              {...register('expropriationProject')}
              placeholder="Nombre del proyecto"
            />
            {errors.expropriationProject && (
              <p className="text-sm text-red-600">{errors.expropriationProject.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgencyLevel">Nivel de Urgencia</Label>
            <Select onValueChange={handleUrgencyLevelChange} defaultValue={watch('urgencyLevel') || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="inmediata">Inmediata</SelectItem>
              </SelectContent>
            </Select>
            {errors.urgencyLevel && (
              <p className="text-sm text-red-600">{errors.urgencyLevel.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetAllocation">Asignación Presupuestaria</Label>
            <Input
              id="budgetAllocation"
              type="number"
              step="0.01"
              {...register('budgetAllocation')}
              placeholder="Monto asignado"
            />
            {errors.budgetAllocation && (
              <p className="text-sm text-red-600">{errors.budgetAllocation.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsibleDepartment">Departamento Responsable</Label>
            <Input
              id="responsibleDepartment"
              {...register('responsibleDepartment')}
              placeholder="Departamento que gestiona"
            />
            {errors.responsibleDepartment && (
              <p className="text-sm text-red-600">{errors.responsibleDepartment.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expropriationJustification">Justificación</Label>
            <Textarea
              id="expropriationJustification"
              {...register('expropriationJustification')}
              placeholder="Justificación detallada de la expropiación"
              rows={4}
            />
            {errors.expropriationJustification && (
              <p className="text-sm text-red-600">{errors.expropriationJustification.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="legalConsiderations">Consideraciones Legales</Label>
            <Textarea
              id="legalConsiderations"
              {...register('legalConsiderations')}
              placeholder="Aspectos legales importantes"
              rows={3}
            />
            {errors.legalConsiderations && (
              <p className="text-sm text-red-600">{errors.legalConsiderations.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}