'use client'

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateCaseInput } from '@/lib/validations/case'

interface PropertyInfoProps {
  register: UseFormRegister<CreateCaseInput>
  errors: FieldErrors<CreateCaseInput>
  setValue: UseFormSetValue<CreateCaseInput>
  watch: UseFormWatch<CreateCaseInput>
}

const PROPERTY_TYPES = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'agricola', label: 'Agrícola' },
  { value: 'gubernamental', label: 'Gubernamental' },
  { value: 'terreno', label: 'Terreno Baldío' },
  { value: 'otro', label: 'Otro' }
]

export function PropertyInfo({ register, errors, setValue, watch }: PropertyInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la Propiedad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="propertyType">Tipo de Propiedad</Label>
            <Select onValueChange={(value) => setValue('propertyType', value)} value={watch('propertyType') || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de propiedad" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.propertyType && (
              <p className="text-sm text-red-600">{errors.propertyType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Dirección de la Propiedad</Label>
            <Input
              id="propertyAddress"
              {...register('propertyAddress')}
              placeholder="Calle Principal #123, Ciudad"
            />
            {errors.propertyAddress && (
              <p className="text-sm text-red-600">{errors.propertyAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyArea">Área (m²)</Label>
            <Input
              id="propertyArea"
              type="number"
              {...register('propertyArea')}
              placeholder="500"
            />
            {errors.propertyArea && (
              <p className="text-sm text-red-600">{errors.propertyArea.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Valor Estimado</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              {...register('estimatedValue')}
              placeholder="1000000.00"
            />
            {errors.estimatedValue && (
              <p className="text-sm text-red-600">{errors.estimatedValue.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="propertyDescription">Descripción de la Propiedad</Label>
            <Textarea
              id="propertyDescription"
              {...register('propertyDescription')}
              placeholder="Detalles adicionales sobre la propiedad"
              rows={3}
            />
            {errors.propertyDescription && (
              <p className="text-sm text-red-600">{errors.propertyDescription.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}