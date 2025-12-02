'use client'

import { Card, CardContent } from '@/components/ui/card'
import { FileText, History, Users } from 'lucide-react'
import { Case } from '@/types/client'

interface CaseStatsProps {
  caseData: Case
}

export function CaseStats({ caseData }: CaseStatsProps) {
  const stats = [
    {
      icon: FileText,
      label: 'Documentos',
      count: caseData._count?.documents || 0,
      color: 'text-blue-600'
    },
    {
      icon: History,
      label: 'Cambios',
      count: caseData._count?.histories || 0,
      color: 'text-green-600'
    },
    {
      icon: Users,
      label: 'Actividades',
      count: caseData._count?.activities || 0,
      color: 'text-orange-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <Icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold">{stat.count}</div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}