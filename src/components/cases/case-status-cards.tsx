'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Building } from 'lucide-react'
import { CASE_STAGES } from '@/constants/case'
import { calculateProgressPercentage } from '@/lib/stage-utils'
import { Case } from '@/types/client'

interface CaseStatusCardsProps {
  caseData: Case
  statusConfig: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
  }
  priorityConfig: {
    label: string
    color: string
  }
}

export function CaseStatusCards({
  caseData,
  statusConfig,
  priorityConfig
}: CaseStatusCardsProps) {
  const StatusIcon = statusConfig.icon

  // Calculate progress based on current stage
  const progressPercentage = calculateProgressPercentage(caseData.currentStage)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado</CardTitle>
          <StatusIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progreso</CardTitle>
          <div className="text-2xl font-bold">{progressPercentage}%</div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="w-full" />
          <p className="text-xs text-muted-foreground mt-2">
            Etapa actual: {CASE_STAGES[caseData.currentStage as keyof typeof CASE_STAGES]}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Departamento</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{caseData.department?.name}</div>
          <p className="text-xs text-muted-foreground">
            {caseData.department?.code}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}