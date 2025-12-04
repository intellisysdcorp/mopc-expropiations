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

const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residencial' },
  { value: 'COMMERCIAL', label: 'Comercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'AGRICULTURAL', label: 'Agrícola' },
  { value: 'MIXED_USE', label: 'Uso Mixto' },
  { value: 'GOVERNMENT', label: 'Gubernamental' },
  { value: 'EDUCATIONAL', label: 'Educativo' },
  { value: 'HEALTHCARE', label: 'Salud' },
  { value: 'RECREATIONAL', label: 'Recreativo' },
  { value: 'RELIGIOUS', label: 'Religioso' },
  { value: 'OTHER', label: 'Otro' },
]

export function PropertyInfo({ register, errors, setValue, watch }: FormSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la Propiedad</CardTitle>
        <CardDescription>
          Detalles del inmueble sujetos a expropiación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="propertyAddress">Dirección de la Propiedad *</Label>
            <Input
              id="propertyAddress"
              {...register('propertyAddress', { required: 'La dirección es requerida' })}
              placeholder="Calle Principal #123, Ciudad"
              className={errors.propertyAddress ? 'border-red-500' : ''}
            />
            {errors.propertyAddress && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyAddress.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="propertyType">Tipo de Propiedad</Label>
            <Select
              value={watch('propertyType')}
              onValueChange={(value) => setValue('propertyType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de propiedad" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.propertyType && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyType.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="propertyCity">Ciudad *</Label>
            <Input
              id="propertyCity"
              {...register('propertyCity', { required: 'La ciudad es requerida' })}
              placeholder="Santo Domingo"
              className={errors.propertyCity ? 'border-red-500' : ''}
            />
            {errors.propertyCity && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyCity.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="propertyProvince">Provincia *</Label>
            <Select
              value={watch('propertyProvince')}
              onValueChange={(value) => setValue('propertyProvince', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar provincia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Distrito Nacional">Distrito Nacional</SelectItem>
                <SelectItem value="Santo Domingo">Santo Domingo</SelectItem>
                <SelectItem value="Santiago">Santiago</SelectItem>
                <SelectItem value="La Altagracia">La Altagracia</SelectItem>
                <SelectItem value="La Romana">La Romana</SelectItem>
                <SelectItem value="La Vega">La Vega</SelectItem>
                <SelectItem value="San Cristóbal">San Cristóbal</SelectItem>
                <SelectItem value="San Pedro de Macorís">San Pedro de Macorís</SelectItem>
                <SelectItem value="San Juan">San Juan</SelectItem>
                <SelectItem value="Monseñor Nouel">Monseñor Nouel</SelectItem>
                <SelectItem value="Puerto Plata">Puerto Plata</SelectItem>
                <SelectItem value="Duarte">Duarte</SelectItem>
                <SelectItem value="Peravia">Peravia</SelectItem>
                <SelectItem value="Azua">Azua</SelectItem>
                <SelectItem value="Barahona">Barahona</SelectItem>
                <SelectItem value="Bahoruco">Bahoruco</SelectItem>
                <SelectItem value="Independencia">Independencia</SelectItem>
                <SelectItem value="Pedernales">Pedernales</SelectItem>
                <SelectItem value="Elías Piña">Elías Piña</SelectItem>
                <SelectItem value="Sánchez Ramírez">Sánchez Ramírez</SelectItem>
                <SelectItem value="Monte Plata">Monte Plata</SelectItem>
                <SelectItem value="Hato Mayor">Hato Mayor</SelectItem>
                <SelectItem value="El Seibo">El Seibo</SelectItem>
                <SelectItem value="La Vega">La Vega</SelectItem>
                <SelectItem value="María Trinidad Sánchez">María Trinidad Sánchez</SelectItem>
                <SelectItem value="Espaillat">Espaillat</SelectItem>
                <SelectItem value="Hermanas Mirabal">Hermanas Mirabal</SelectItem>
                <SelectItem value="Salcedo">Salcedo</SelectItem>
                <SelectItem value="Ramón Santana">Ramón Santana</SelectItem>
                <SelectItem value="Miches">Miches</SelectItem>
                <SelectItem value="José Contreras">José Contreras</SelectItem>
                <SelectItem value="San José de Ocoa">San José de Ocoa</SelectItem>
              </SelectContent>
            </Select>
            {errors.propertyProvince && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyProvince.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="propertyArea">Área (m²)</Label>
            <Input
              id="propertyArea"
              type="number"
              step="0.01"
              {...register('propertyArea', {
                valueAsNumber: true,
                min: { value: 0, message: 'El área debe ser positiva' },
                max: { value: 1000000, message: 'El área no puede exceder 1,000,000 m²' }
              })}
              placeholder="250.00"
              className={errors.propertyArea ? 'border-red-500' : ''}
            />
            {errors.propertyArea && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyArea.message as string}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="propertyCoordinates">Coordenadas (latitud,longitud)</Label>
            <Input
              id="propertyCoordinates"
              {...register('propertyCoordinates', {
                pattern: {
                  value: /^-?\d+\.?\d*,-?\d+\.?\d*$/,
                  message: 'Las coordenadas deben estar en formato latitud,longitud'
                }
              })}
              placeholder="18.4764,-69.8943"
              className={errors.propertyCoordinates ? 'border-red-500' : ''}
            />
            {errors.propertyCoordinates && (
              <p className="text-sm text-red-500 mt-1">
                {errors.propertyCoordinates.message as string}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Formato: latitud,longitud (ej: 18.4764,-69.8943)
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="propertyDescription">Descripción de la Propiedad</Label>
          <Textarea
            id="propertyDescription"
            {...register('propertyDescription')}
            placeholder="Descripción detallada de las características físicas de la propiedad..."
            rows={4}
            maxLength={1000}
          />
          <div className="text-xs text-muted-foreground mt-1">
            {watch('propertyDescription')?.length || 0}/1000 caracteres
          </div>
          {errors.propertyDescription && (
            <p className="text-sm text-red-500 mt-1">
              {errors.propertyDescription.message as string}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}