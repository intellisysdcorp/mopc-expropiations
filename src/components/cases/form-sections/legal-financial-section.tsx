import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FormField, TextInput, NumberInput, SelectInput } from '@/components/forms/form-fields'
import { CURRENCIES } from '@/constants/case-constants'
import { CreateCaseInput, UpdateCaseInput } from '@/lib/validations/case'

interface LegalFinancialSectionProps {
  formData: CreateCaseInput | UpdateCaseInput
  onInputChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: any) => void
  onNumberChange: (field: keyof (CreateCaseInput | UpdateCaseInput), value: string) => void
}

export function LegalFinancialSection({
  formData,
  onInputChange,
}: LegalFinancialSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Legal y Financiera</CardTitle>
        <CardDescription>
          Detalles legales y financieros del caso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Información Financiera</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="estimatedValue"
              label="Valor Estimado"
            >
              <NumberInput
                id="estimatedValue"
                value={formData.estimatedValue}
                onChange={(value) => onInputChange('estimatedValue', value)}
                placeholder="5000000"
                step="0.01"
              />
            </FormField>

            <FormField
              id="actualValue"
              label="Valor Real"
            >
              <NumberInput
                id="actualValue"
                value={formData.actualValue}
                onChange={(value) => onInputChange('actualValue', value)}
                placeholder="5200000"
                step="0.01"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="appraisalValue"
              label="Valor de Tasación"
            >
              <NumberInput
                id="appraisalValue"
                value={formData.appraisalValue}
                onChange={(value) => onInputChange('appraisalValue', value)}
                placeholder="5100000"
                step="0.01"
              />
            </FormField>

            <FormField
              id="compensationAmount"
              label="Monto de Compensación"
            >
              <NumberInput
                id="compensationAmount"
                value={formData.compensationAmount}
                onChange={(value) => onInputChange('compensationAmount', value)}
                placeholder="5150000"
                step="0.01"
              />
            </FormField>
          </div>

          <FormField
            id="currency"
            label="Moneda"
          >
            <SelectInput
              id="currency"
              value={formData.currency || 'DOP'}
              onChange={(value) => onInputChange('currency', value)}
              placeholder="Seleccionar moneda"
              options={CURRENCIES}
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  )
}