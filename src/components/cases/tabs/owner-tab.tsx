'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User } from 'lucide-react'
import { Case } from '@/types/client'

interface OwnerTabProps {
  caseData: Case
}

export function OwnerTab({ caseData }: OwnerTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Propietario</CardTitle>
        <CardDescription>
          Datos del propietario actual de la propiedad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Nombre</h4>
                <p className="text-sm text-muted-foreground">{caseData.ownerName}</p>
                {caseData.ownerType && (
                  <Badge variant="outline" className="mt-1">
                    {caseData.ownerType}
                  </Badge>
                )}
              </div>
            </div>

            {caseData.ownerIdentification && (
              <div>
                <h4 className="font-medium mb-2">Identificación</h4>
                <p className="text-sm text-muted-foreground">{caseData.ownerIdentification}</p>
              </div>
            )}

            {caseData.ownerAddress && (
              <div>
                <h4 className="font-medium mb-2">Dirección</h4>
                <p className="text-sm text-muted-foreground">{caseData.ownerAddress}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {caseData.ownerContact && (
              <div>
                <h4 className="font-medium mb-2">Contacto</h4>
                <p className="text-sm text-muted-foreground">{caseData.ownerContact}</p>
              </div>
            )}

            {caseData.ownerEmail && (
              <div>
                <h4 className="font-medium mb-2">Email</h4>
                <p className="text-sm text-muted-foreground">{caseData.ownerEmail}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}