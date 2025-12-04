'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CaseStats } from '@/components/cases/case-stats'
import { formatDate } from '@/lib/format'
import { getUserInitials, getUserName } from '@/lib/user-utils'
import { Case } from '@/types/client'

interface OverviewTabProps {
  caseData: Case
}

export function OverviewTab({ caseData }: OverviewTabProps) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
          <CardDescription>
            Detalles básicos del caso de expropiación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseData.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Descripción</h4>
              <p className="text-sm text-muted-foreground">{caseData.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Fechas Importantes</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Inicio:</span>
                  <span>{formatDate(caseData.startDate)}</span>
                </div>
                {caseData.expectedEndDate && (
                  <div className="flex justify-between text-sm">
                    <span>Finalización estimada:</span>
                    <span>{formatDate(caseData.expectedEndDate)}</span>
                  </div>
                )}
                {caseData.actualEndDate && (
                  <div className="flex justify-between text-sm">
                    <span>Finalización real:</span>
                    <span>{formatDate(caseData.actualEndDate)}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Asignación</h4>
              <div className="space-y-2">
                {caseData.assignedTo && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {getUserInitials(caseData.assignedTo)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <div className="font-medium">
                        {getUserName(caseData.assignedTo)}
                      </div>
                      <div className="text-muted-foreground">Asignado</div>
                    </div>
                  </div>
                )}
                {caseData.supervisedBy && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {getUserInitials(caseData.supervisedBy)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <div className="font-medium">
                        {getUserName(caseData.supervisedBy)}
                      </div>
                      <div className="text-muted-foreground">Supervisor</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CaseStats caseData={caseData} />
    </div>
  )
}