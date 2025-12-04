'use client'

import { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import clientLogger from '@/lib/client-logger'

interface FormSectionProps {
  register: UseFormRegister<any>
  errors: FieldErrors
  control: Control<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
}

const PRIORITIES = [
  { value: 'LOW', label: 'Baja', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' },
]

const STATUSES = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EN_PROGRESO', label: 'En Progreso', color: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETADO', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'ARCHIVED', label: 'Archivado', color: 'bg-gray-100 text-gray-800' },
  { value: 'SUSPENDED', label: 'Suspendido', color: 'bg-orange-100 text-orange-800' },
  { value: 'CANCELLED', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
]

export function CaseBasicInfo({ register, errors, setValue, watch }: FormSectionProps) {
  const generateCaseNumber = async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    let index = 0;
    try {
      // Get today's case count from database
      const response = await fetch('/api/cases/count-today', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to get case count')
      }

      const data = await response.json()
      index = data.count + 1 // Next case number
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error getting number of cases:', error)
      }
    }
    const caseNumber = `EXP-${year}${month}${day}-${index.toString().padStart(3, '0')}`
    setValue('fileNumber', caseNumber)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Básica</CardTitle>
        <CardDescription>
          Información general del caso de expropiación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="fileNumber">Número de Expediente *</Label>
            <div className="flex space-x-2">
              <Input
                id="fileNumber"
                {...register('fileNumber', { required: 'El número de expediente es requerido' })}
                placeholder="EXP-20241106-001"
                className={errors.fileNumber ? 'border-red-500' : ''}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generateCaseNumber()}
                className="whitespace-nowrap"
                title="Generar número de expediente automáticamente"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Generar
              </Button>
            </div>
            {errors.fileNumber && (
              <p className="text-sm text-red-500 mt-1">
                {errors.fileNumber.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Título del Caso *</Label>
            <Input
              id="title"
              {...register('title', { required: 'El título es requerido' })}
              placeholder="Descripción breve del caso"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-500 mt-1">
                {errors.title.message as string}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Descripción detallada del caso..."
            rows={4}
          />
          {errors.description && (
            <p className="text-sm text-red-500 mt-1">
              {errors.description.message as string}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label htmlFor="priority">Prioridad</Label>
            <Select
              value={watch('priority')}
              onValueChange={(value) => setValue('priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar prioridad" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(priority => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${priority.color.split(' ')[0]}`} />
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-500 mt-1">
                {errors.priority.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="status">Estado</Label>
            <Select
              value={watch('status')}
              onValueChange={(value) => setValue('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status.color.split(' ')[0]}`} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-red-500 mt-1">
                {errors.status.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="currentStage">Etapa Actual</Label>
            <Select
              value={watch('currentStage')}
              onValueChange={(value) => setValue('currentStage', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEPCION_SOLICITUD">Recepción de Solicitud</SelectItem>
                <SelectItem value="VERIFICACION_REQUISITOS">Verificación de Requisitos</SelectItem>
                <SelectItem value="CARGA_DOCUMENTOS">Carga de Documentos</SelectItem>
                <SelectItem value="ASIGNACION_ANALISTA">Asignación de Analista</SelectItem>
                <SelectItem value="ANALISIS_PRELIMINAR">Análisis Preliminar</SelectItem>
                <SelectItem value="NOTIFICACION_PROPIETARIO">Notificación al Propietario</SelectItem>
                <SelectItem value="PERITAJE_TECNICO">Peritaje Técnico</SelectItem>
                <SelectItem value="DETERMINACION_VALOR">Determinación de Valor</SelectItem>
                <SelectItem value="OFERTA_COMPRA">Oferta de Compra</SelectItem>
                <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                <SelectItem value="APROBACION_ACUERDO">Aprobación de Acuerdo</SelectItem>
                <SelectItem value="ELABORACION_ESCRITURA">Elaboración de Escritura</SelectItem>
                <SelectItem value="FIRMA_DOCUMENTOS">Firma de Documentos</SelectItem>
                <SelectItem value="REGISTRO_PROPIEDAD">Registro de Propiedad</SelectItem>
                <SelectItem value="DESEMBOLSO_PAGO">Desembolso y Pago</SelectItem>
                <SelectItem value="ENTREGA_INMUEBLE">Entrega del Inmueble</SelectItem>
                <SelectItem value="CIERRE_ARCHIVO">Cierre de Archivo</SelectItem>
              </SelectContent>
            </Select>
            {errors.currentStage && (
              <p className="text-sm text-red-500 mt-1">
                {errors.currentStage.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="startDate">Fecha de Inicio</Label>
            <Input
              id="startDate"
              type="date"
              {...register('startDate')}
            />
            {errors.startDate && (
              <p className="text-sm text-red-500 mt-1">
                {errors.startDate.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="expectedEndDate">Fecha de Finalización Esperada</Label>
            <Input
              id="expectedEndDate"
              type="date"
              {...register('expectedEndDate')}
            />
            {errors.expectedEndDate && (
              <p className="text-sm text-red-500 mt-1">
                {errors.expectedEndDate.message as string}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="departmentId">Departamento *</Label>
          <Select
            value={watch('departmentId')}
            onValueChange={(value) => setValue('departmentId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dept-1">Departamento Legal</SelectItem>
              <SelectItem value="dept-2">Departamento Técnico</SelectItem>
              <SelectItem value="dept-3">Departamento Financiero</SelectItem>
            </SelectContent>
          </Select>
          {errors.departmentId && (
            <p className="text-sm text-red-500 mt-1">
              {errors.departmentId.message as string}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}