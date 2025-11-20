import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField, TextInput, NumberInput, SelectInput } from '@/components/forms/form-fields'
import { PROPERTY_TYPES } from '@/constants/case-constants'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

interface PropertyInfoSectionProps {
  formData: CreateCaseInput | UpdateCaseInput
  onInputChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => void
  onNumberChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: string) => void
  hasFieldError?: (field: string) => boolean
}

export function PropertyInfoSection({
  formData,
  onInputChange,
  hasFieldError
}: PropertyInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la Propiedad</CardTitle>
        <CardDescription>
          Detalles sobre el inmueble a expropiar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          id="propertyAddress"
          label="Dirección de la Propiedad"
          required
          error={hasFieldError?.('propertyAddress')}
        >
          <TextInput
            id="propertyAddress"
            value={formData.propertyAddress}
            onChange={(value) => onInputChange('propertyAddress', value)}
            placeholder="Calle Principal #123, Ciudad"
            error={hasFieldError?.('propertyAddress')}
            required
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="propertyCity"
            label="Ciudad"
            required
            error={hasFieldError?.('propertyCity')}
          >
            <TextInput
              id="propertyCity"
              value={formData.propertyCity}
              onChange={(value) => onInputChange('propertyCity', value)}
              placeholder="Santo Domingo"
              error={hasFieldError?.('propertyCity')}
              required
            />
          </FormField>

          <FormField
            id="propertyProvince"
            label="Provincia"
            required
            error={hasFieldError?.('propertyProvince')}
          >
            <TextInput
              id="propertyProvince"
              value={formData.propertyProvince}
              onChange={(value) => onInputChange('propertyProvince', value)}
              placeholder="Santo Domingo"
              error={hasFieldError?.('propertyProvince')}
              required
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="propertyType"
            label="Tipo de Propiedad"
          >
            <SelectInput
              id="propertyType"
              value={formData.propertyType}
              onChange={(value) => onInputChange('propertyType', value)}
              placeholder="Seleccionar tipo"
              options={PROPERTY_TYPES}
            />
          </FormField>

          <FormField
            id="propertyArea"
            label="Área (m²)"
          >
            <NumberInput
              id="propertyArea"
              value={formData.propertyArea}
              onChange={(value) => onInputChange('propertyArea', value)}
              placeholder="500"
              step="0.01"
            />
          </FormField>
        </div>

        <FormField
          id="propertyDescription"
          label="Descripción de la Propiedad"
        >
          <TextInput
            id="propertyDescription"
            value={formData.propertyDescription}
            onChange={(value) => onInputChange('propertyDescription', value)}
            placeholder="Descripción detallada de las características de la propiedad"
            type="textarea"
          />
        </FormField>

        <FormField
          id="propertyCoordinates"
          label="Coordenadas GPS"
        >
          <TextInput
            id="propertyCoordinates"
            value={formData.propertyCoordinates}
            onChange={(value) => onInputChange('propertyCoordinates', value)}
            placeholder="18.4802,-69.9388"
          />
          <p className="text-sm text-muted-foreground">
            Formato: latitud,longitud (ej: 18.4802,-69.9388)
          </p>
        </FormField>

        <FormField
          id="estimatedValue"
          label="Valor Estimado (DOP)"
        >
          <NumberInput
            id="estimatedValue"
            value={formData.estimatedValue}
            onChange={(value) => onInputChange('estimatedValue', value)}
            placeholder="5000000"
            step="0.01"
          />
          <p className="text-sm text-muted-foreground">
            Valor estimado de la propiedad para fines de expropiación
          </p>
        </FormField>
      </CardContent>
    </Card>
  )
}