'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Scale } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { Case } from '@/types/client'

interface LegalTabProps {
  caseData: Case
}

export function LegalTab({ caseData }: LegalTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Legal</CardTitle>
        <CardDescription>
          Detalles legales y judiciales del caso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {caseData.expropriationDecree && (
            <div className="flex items-start gap-3">
              <Scale className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Decreto de Expropiación</h4>
                <p className="text-sm text-muted-foreground">{caseData.expropriationDecree}</p>
              </div>
            </div>
          )}

          {caseData.judicialCaseNumber && (
            <div>
              <h4 className="font-medium mb-2">Caso Judicial</h4>
              <p className="text-sm text-muted-foreground">{caseData.judicialCaseNumber}</p>
            </div>
          )}

          {caseData.legalStatus && (
            <div>
              <h4 className="font-medium mb-2">Estado Legal</h4>
              <Badge variant="outline">{caseData.legalStatus}</Badge>
            </div>
          )}
        </div>

        {(caseData.actualValue || caseData.appraisalValue || caseData.compensationAmount) && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-4">Información Financiera</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {caseData.actualValue && (
                  <div>
                    <h5 className="text-sm font-medium text-muted-foreground mb-1">Valor Real</h5>
                    <p className="text-lg font-semibold">
                      {formatCurrency(caseData.actualValue, caseData.currency)}
                    </p>
                  </div>
                )}
                {caseData.appraisalValue && (
                  <div>
                    <h5 className="text-sm font-medium text-muted-foreground mb-1">Valor de Tasación</h5>
                    <p className="text-lg font-semibold">
                      {formatCurrency(caseData.appraisalValue, caseData.currency)}
                    </p>
                  </div>
                )}
                {caseData.compensationAmount && (
                  <div>
                    <h5 className="text-sm font-medium text-muted-foreground mb-1">Monto de Compensación</h5>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(caseData.compensationAmount, caseData.currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}