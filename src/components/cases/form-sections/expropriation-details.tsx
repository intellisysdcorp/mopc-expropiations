'use client'

import { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FormSectionProps {
  register: UseFormRegister<any>
  errors: FieldErrors
  control: Control<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
}

const EXPROPRIATION_REASONS = [
  { value: 'PUBLIC_UTILITIES', label: 'Servicios Públicos' },
  { value: 'INFRASTRUCTURE', label: 'Infraestructura Vial' },
  { value: 'URBAN_DEVELOPMENT', label: 'Desarrollo Urbano' },
  { value: 'SOCIAL_INTEREST', label: 'Interés Social' },
  { value: 'ENVIRONMENTAL', label: 'Protección Ambiental' },
  { value: 'SECURITY', label: 'Seguridad Nacional' },
  { value: 'EDUCATION', label: 'Proyectos Educativos' },
  { value: 'HEALTH', label: 'Proyectos de Salud' },
  { value: 'TRANSPORTATION', label: 'Transporte Público' },
  { value: 'PARKS_RECREATION', label: 'Parques y Recreación' },
  { value: 'GOVERNMENT_FACILITIES', label: 'Instalaciones Gubernamentales' },
  { value: 'OTHER', label: 'Otro' },
]

const LEGAL_FRAMEWORKS = [
  { value: 'CONSTITUTION_ARTICLE_54', label: 'Artículo 54 Constitucional' },
  { value: 'EXPROPRIATION_LAW_211', label: 'Ley 211 de Expropiación' },
  { value: 'PUBLIC_SERVICES_LAW', label: 'Ley de Servicios Públicos' },
  { value: 'URBAN_PLANNING_LAW', label: 'Ley de Planificación Urbana' },
  { value: 'ENVIRONMENTAL_LAW_64', label: 'Ley 64-00 sobre Medio Ambiente' },
  { value: 'INFRASTRUCTURE_LAW', label: 'Ley de Infraestructura' },
  { value: 'TRANSPORTATION_LAW', label: 'Ley de Transporte Terrestre' },
  { value: 'HEALTH_CODE', label: 'Código de Salud' },
  { value: 'EDUCATION_LAW', label: 'Ley General de Educación' },
  { value: 'MUNICIPAL_REGULATIONS', label: 'Regulaciones Municipales' },
  { value: 'PRESIDENTIAL_DECREE', label: 'Decreto Presidencial' },
  { value: 'OTHER', label: 'Otro' },
]

export function ExpropriationDetails({ register, errors, setValue, watch }: FormSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles de la Expropiación</CardTitle>
        <CardDescription>
          Información legal y financiera del proceso de expropiación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="expropriationDecree">Decreto de Expropiación</Label>
            <Input
              id="expropriationDecree"
              {...register('expropriationDecree')}
              placeholder="123-2024"
              className={errors.expropriationDecree ? 'border-red-500' : ''}
            />
            {errors.expropriationDecree && (
              <p className="text-sm text-red-500 mt-1">
                {errors.expropriationDecree.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="judicialCaseNumber">Número de Caso Judicial</Label>
            <Input
              id="judicialCaseNumber"
              {...register('judicialCaseNumber')}
              placeholder="2024-00001-0501-00000"
              className={errors.judicialCaseNumber ? 'border-red-500' : ''}
            />
            {errors.judicialCaseNumber && (
              <p className="text-sm text-red-500 mt-1">
                {errors.judicialCaseNumber.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="expropriationReason">Razón de Expropiación</Label>
            <Select
              value={watch('expropriationReason')}
              onValueChange={(value) => setValue('expropriationReason', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar razón de expropiación" />
              </SelectTrigger>
              <SelectContent>
                {EXPROPRIATION_REASONS.map(reason => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.expropriationReason && (
              <p className="text-sm text-red-500 mt-1">
                {errors.expropriationReason.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="legalFramework">Marco Legal</Label>
            <Select
              value={watch('legalFramework')}
              onValueChange={(value) => setValue('legalFramework', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar marco legal" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_FRAMEWORKS.map(framework => (
                  <SelectItem key={framework.value} value={framework.value}>
                    {framework.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.legalFramework && (
              <p className="text-sm text-red-500 mt-1">
                {errors.legalFramework.message as string}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="legalStatus">Estado Legal</Label>
          <Select
            value={watch('legalStatus')}
            onValueChange={(value) => setValue('legalStatus', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estado legal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="IN_PROCESS">En Proceso</SelectItem>
              <SelectItem value="JUDICIAL_REVIEW">Revisión Judicial</SelectItem>
              <SelectItem value="APPROVED">Aprobado</SelectItem>
              <SelectItem value="CONTESTED">Contestado</SelectItem>
              <SelectItem value="SUSPENDED">Suspendido</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
            </SelectContent>
          </Select>
          {errors.legalStatus && (
            <p className="text-sm text-red-500 mt-1">
              {errors.legalStatus.message as string}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <Label htmlFor="estimatedValue">Valor Estimado (DOP)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="1000"
              {...register('estimatedValue', {
                valueAsNumber: true,
                min: { value: 0, message: 'El valor debe ser positivo' },
                max: { value: 1000000000, message: 'El valor no puede exceder 1,000,000,000' }
              })}
              placeholder="5000000.00"
              className={errors.estimatedValue ? 'border-red-500' : ''}
            />
            {errors.estimatedValue && (
              <p className="text-sm text-red-500 mt-1">
                {errors.estimatedValue.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="actualValue">Valor Real (DOP)</Label>
            <Input
              id="actualValue"
              type="number"
              step="1000"
              {...register('actualValue', {
                valueAsNumber: true,
                min: { value: 0, message: 'El valor debe ser positivo' },
                max: { value: 1000000000, message: 'El valor no puede exceder 1,000,000,000' }
              })}
              placeholder="4500000.00"
              className={errors.actualValue ? 'border-red-500' : ''}
            />
            {errors.actualValue && (
              <p className="text-sm text-red-500 mt-1">
                {errors.actualValue.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="appraisalValue">Valor de Tasación (DOP)</Label>
            <Input
              id="appraisalValue"
              type="number"
              step="1000"
              {...register('appraisalValue', {
                valueAsNumber: true,
                min: { value: 0, message: 'El valor debe ser positivo' },
                max: { value: 1000000000, message: 'El valor no puede exceder 1,000,000,000' }
              })}
              placeholder="4800000.00"
              className={errors.appraisalValue ? 'border-red-500' : ''}
            />
            {errors.appraisalValue && (
              <p className="text-sm text-red-500 mt-1">
                {errors.appraisalValue.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="compensationAmount">Monto de Compensación (DOP)</Label>
            <Input
              id="compensationAmount"
              type="number"
              step="1000"
              {...register('compensationAmount', {
                valueAsNumber: true,
                min: { value: 0, message: 'El monto debe ser positivo' },
                max: { value: 1000000000, message: 'El monto no puede exceder 1,000,000,000' }
              })}
              placeholder="4700000.00"
              className={errors.compensationAmount ? 'border-red-500' : ''}
            />
            {errors.compensationAmount && (
              <p className="text-sm text-red-500 mt-1">
                {errors.compensationAmount.message as string}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="currency">Moneda</Label>
          <Select
            value={watch('currency')}
            onValueChange={(value) => setValue('currency', value)}
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
          {errors.currency && (
            <p className="text-sm text-red-500 mt-1">
              {errors.currency.message as string}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}