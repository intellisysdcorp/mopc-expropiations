import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FormField, TextInput, SelectInput } from '@/components/forms/form-fields'
import { OWNER_TYPES } from '@/constants/case-constants'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

interface OwnerInfoSectionProps {
  formData: CreateCaseInput | UpdateCaseInput
  onInputChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => void
  hasFieldError?: (field: string) => boolean
  includeLegalInfo?: boolean // For edit mode, legal info is in a separate section
}

export function OwnerInfoSection({
  formData,
  onInputChange,
  hasFieldError,
  includeLegalInfo = true
}: OwnerInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Propietario</CardTitle>
        <CardDescription>
          Datos del propietario actual de la propiedad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="ownerName"
            label="Nombre del Propietario"
            required
            error={hasFieldError?.('ownerName') || false}
          >
            <TextInput
              id="ownerName"
              value={formData.ownerName}
              onChange={(value) => onInputChange('ownerName', value)}
              placeholder="Juan Pérez"
              error={hasFieldError?.('ownerName') || false}
              required
            />
          </FormField>

          <FormField
            id="ownerType"
            label="Tipo de Propietario"
          >
            <SelectInput
              id="ownerType"
              value={formData.ownerType || 'individual'}
              onChange={(value) => onInputChange('ownerType', value)}
              placeholder="Seleccionar tipo"
              options={OWNER_TYPES}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="ownerIdentification"
            label="Identificación"
          >
            <TextInput
              id="ownerIdentification"
              value={formData.ownerIdentification || undefined}
              onChange={(value) => onInputChange('ownerIdentification', value)}
              placeholder="123-4567890-1"
            />
          </FormField>

          <FormField
            id="ownerContact"
            label="Teléfono"
          >
            <TextInput
              id="ownerContact"
              value={formData.ownerContact || undefined}
              onChange={(value) => onInputChange('ownerContact', value)}
              placeholder="809-555-0123"
            />
          </FormField>
        </div>

        <FormField
          id="ownerEmail"
          label="Email"
        >
          <TextInput
            id="ownerEmail"
            value={formData.ownerEmail || undefined}
            onChange={(value) => onInputChange('ownerEmail', value)}
            type="email"
            placeholder="juan.perez@email.com"
          />
        </FormField>

        <FormField
          id="ownerAddress"
          label="Dirección del Propietario"
        >
          <TextInput
            id="ownerAddress"
            value={formData.ownerAddress}
            onChange={(value) => onInputChange('ownerAddress', value)}
            placeholder="Calle Secundaria #456, Ciudad"
          />
        </FormField>

        {includeLegalInfo && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información Legal</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  id="expropriationDecree"
                  label="Decreto de Expropiación"
                >
                  <TextInput
                    id="expropriationDecree"
                    value={formData.expropriationDecree}
                    onChange={(value) => onInputChange('expropriationDecree', value)}
                    placeholder="Decreto XXX-2024"
                  />
                </FormField>

                <FormField
                  id="judicialCaseNumber"
                  label="Número de Caso Judicial"
                >
                  <TextInput
                    id="judicialCaseNumber"
                    value={formData.judicialCaseNumber}
                    onChange={(value) => onInputChange('judicialCaseNumber', value)}
                    placeholder="2024-1234"
                  />
                </FormField>
              </div>

              <FormField
                id="legalStatus"
                label="Estado Legal"
              >
                <TextInput
                  id="legalStatus"
                  value={formData.legalStatus}
                  onChange={(value) => onInputChange('legalStatus', value)}
                  placeholder="En proceso judicial"
                />
              </FormField>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}