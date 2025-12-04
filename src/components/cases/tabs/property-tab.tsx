'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'
import { formatCurrency, formatArea } from '@/lib/format'
import { Case } from '@/types/client'

interface PropertyTabProps {
  caseData: Case
}

export function PropertyTab({ caseData }: PropertyTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la Propiedad</CardTitle>
        <CardDescription>
          Detalles del inmueble sujeto a expropiación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Dirección</h4>
                <p className="text-sm text-muted-foreground">{caseData.propertyAddress}</p>
                <p className="text-sm text-muted-foreground">
                  {caseData.propertyCity}, {caseData.propertyProvince}
                </p>
              </div>
            </div>

            {caseData.propertyType && (
              <div>
                <h4 className="font-medium mb-2">Tipo de Propiedad</h4>
                <Badge variant="outline">{caseData.propertyType}</Badge>
              </div>
            )}

            {caseData.propertyCoordinates && (
              <div>
                <h4 className="font-medium mb-2">Coordenadas GPS</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  {caseData.propertyCoordinates}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {caseData.propertyArea && (
              <div>
                <h4 className="font-medium mb-2">Área</h4>
                <p className="text-sm text-muted-foreground">
                  {formatArea(caseData.propertyArea)}
                </p>
              </div>
            )}

            {caseData.estimatedValue && (
              <div>
                <h4 className="font-medium mb-2">Valor Estimado</h4>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(caseData.estimatedValue, caseData.currency)}
                </p>
              </div>
            )}
          </div>
        </div>

        {caseData.propertyDescription && (
          <div>
            <h4 className="font-medium mb-2">Descripción de la Propiedad</h4>
            <p className="text-sm text-muted-foreground">{caseData.propertyDescription}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}