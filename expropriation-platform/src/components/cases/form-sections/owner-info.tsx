'use client'

import { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FormSectionProps {
  register: UseFormRegister<any>
  errors: FieldErrors
  control: Control<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
}

const OWNER_TYPES = [
  { value: 'INDIVIDUAL', label: 'Persona Física' },
  { value: 'CORPORATION', label: 'Persona Jurídica' },
  { value: 'GOVERNMENT', label: 'Gobierno' },
  { value: 'NGO', label: 'ONG' },
  { value: 'TRUST', label: 'Fideicomiso' },
  { value: 'PARTNERSHIP', label: 'Sociedad' },
  { value: 'JOINT_OWNERSHIP', label: 'Copropiedad' },
  { value: 'OTHER', label: 'Otro' },
]

export function OwnerInfo({ register, errors, setValue, watch }: FormSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Propietario</CardTitle>
        <CardDescription>
          Datos del propietario actual del inmueble
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="ownerName">Nombre del Propietario *</Label>
            <Input
              id="ownerName"
              {...register('ownerName', { required: 'El nombre del propietario es requerido' })}
              placeholder="Juan Pérez García"
              className={errors.ownerName ? 'border-red-500' : ''}
            />
            {errors.ownerName && (
              <p className="text-sm text-red-500 mt-1">
                {errors.ownerName.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ownerType">Tipo de Propietario</Label>
            <Select
              value={watch('ownerType')}
              onValueChange={(value) => setValue('ownerType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de propietario" />
              </SelectTrigger>
              <SelectContent>
                {OWNER_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ownerType && (
              <p className="text-sm text-red-500 mt-1">
                {errors.ownerType.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="ownerIdentification">Identificación</Label>
            <Input
              id="ownerIdentification"
              {...register('ownerIdentification')}
              placeholder="123-456789-0"
              className={errors.ownerIdentification ? 'border-red-500' : ''}
            />
            {errors.ownerIdentification && (
              <p className="text-sm text-red-500 mt-1">
                {errors.ownerIdentification.message as string}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Cédula, RNC o número de identificación fiscal
            </p>
          </div>

          <div>
            <Label htmlFor="ownerContact">Teléfono</Label>
            <Input
              id="ownerContact"
              {...register('ownerContact', {
                pattern: {
                  value: /^[+]?[\d\s\-\(\)]+$/,
                  message: 'El teléfono debe contener solo números y caracteres válidos'
                }
              })}
              placeholder="+1 (809) 123-4567"
              className={errors.ownerContact ? 'border-red-500' : ''}
            />
            {errors.ownerContact && (
              <p className="text-sm text-red-500 mt-1">
                {errors.ownerContact.message as string}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="ownerEmail">Correo Electrónico</Label>
          <Input
            id="ownerEmail"
            type="email"
            {...register('ownerEmail', {
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'El email no es válido'
              }
            })}
            placeholder="propietario@ejemplo.com"
            className={errors.ownerEmail ? 'border-red-500' : ''}
          />
          {errors.ownerEmail && (
            <p className="text-sm text-red-500 mt-1">
              {errors.ownerEmail.message as string}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="ownerAddress">Dirección del Propietario</Label>
          <Textarea
            id="ownerAddress"
            {...register('ownerAddress')}
            placeholder="Dirección completa del propietario para notificaciones..."
            rows={3}
            maxLength={300}
          />
          <div className="text-xs text-muted-foreground mt-1">
            {watch('ownerAddress')?.length || 0}/300 caracteres
          </div>
          {errors.ownerAddress && (
            <p className="text-sm text-red-500 mt-1">
              {errors.ownerAddress.message as string}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}