'use client'

import { UseFormRegister, FieldErrors } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateCaseInput } from '@/lib/validations/case'

interface CaseBasicInfoProps {
  register: UseFormRegister<CreateCaseInput>
  errors: FieldErrors<CreateCaseInput>
  setValue: (field: keyof CreateCaseInput, value: any) => void
  watch: (field: keyof CreateCaseInput) => any
}

const PRIORITIES = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
]

export function CaseBasicInfo({ register, errors, setValue, watch }: CaseBasicInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Básica del Caso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fileNumber">Número de Expediente</Label>
            <Input
              id="fileNumber"
              {...register('fileNumber')}
              placeholder="EXP-2024-001"
            />
            {errors.fileNumber && (
              <p className="text-sm text-red-600">{errors.fileNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad</Label>
            <Select onValueChange={(value) => setValue('priority', value as any)} defaultValue={watch('priority')}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar prioridad" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-600">{errors.priority.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Título del Caso</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Breve descripción del caso"
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descripción detallada del caso"
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">Departamento</Label>
            <Select onValueChange={(value) => setValue('departmentId', value as any)} defaultValue={watch('departmentId')}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dept-1">Dirección General de Bienes Nacionales</SelectItem>
                <SelectItem value="dept-2">Departamento Legal</SelectItem>
                <SelectItem value="dept-3">Departamento de Avalúos</SelectItem>
              </SelectContent>
            </Select>
            {errors.departmentId && (
              <p className="text-sm text-red-600">{errors.departmentId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedEndDate">Fecha de Finalización Esperada</Label>
            <Input
              id="expectedEndDate"
              type="date"
              {...register('expectedEndDate')}
            />
            {errors.expectedEndDate && (
              <p className="text-sm text-red-600">{errors.expectedEndDate.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}