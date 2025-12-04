'use client'

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateCaseInput } from '@/lib/validations/case'

interface OwnerInfoProps {
  register: UseFormRegister<CreateCaseInput>
  errors: FieldErrors<CreateCaseInput>
  setValue: UseFormSetValue<CreateCaseInput>
  watch: UseFormWatch<CreateCaseInput>
}

const OWNER_TYPES = [
  { value: 'individual', label: 'Persona Individual' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'gobierno', label: 'Gobierno' },
  { value: 'organizacion', label: 'Organización' },
  { value: 'sucesion', label: 'Sucesión' }
]

export function OwnerInfo({ register, errors, setValue, watch }: OwnerInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Propietario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerType">Tipo de Propietario</Label>
            <Select
            onValueChange={(value) => setValue('ownerType', value)}
            value={watch('ownerType') ?? ''}
          >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de propietario" />
              </SelectTrigger>
              <SelectContent>
                {OWNER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ownerType && (
              <p className="text-sm text-red-600">{errors.ownerType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Nombre del Propietario</Label>
            <Input
              id="ownerName"
              {...register('ownerName')}
              placeholder="Nombre completo o razón social"
            />
            {errors.ownerName && (
              <p className="text-sm text-red-600">{errors.ownerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerIdentification">Identificación</Label>
            <Input
              id="ownerIdentification"
              {...register('ownerIdentification')}
              placeholder="Cédula/RNC/ Pasaporte"
            />
            {errors.ownerIdentification && (
              <p className="text-sm text-red-600">{errors.ownerIdentification.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerContact">Contacto</Label>
            <Input
              id="ownerContact"
              {...register('ownerContact')}
              placeholder="Teléfono o email"
            />
            {errors.ownerContact && (
              <p className="text-sm text-red-600">{errors.ownerContact.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerAddress">Dirección del Propietario</Label>
            <Input
              id="ownerAddress"
              {...register('ownerAddress')}
              placeholder="Dirección completa"
            />
            {errors.ownerAddress && (
              <p className="text-sm text-red-600">{errors.ownerAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Email del Propietario</Label>
            <Input
              id="ownerEmail"
              {...register('ownerEmail')}
              placeholder="correo@ejemplo.com"
              type="email"
            />
            {errors.ownerEmail && (
              <p className="text-sm text-red-600">{errors.ownerEmail.message}</p>
            )}
          </div>

          </div>
      </CardContent>
    </Card>
  )
}