'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDate } from '@/lib/format'
import { getUserInitials, getUserName } from '@/lib/user-utils'
import { Case } from '@/types/client'

interface ActivityTabProps {
  caseData: Case
}

export function ActivityTab({ caseData }: ActivityTabProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>
          Historial de cambios y actividades del caso
        </CardDescription>
      </CardHeader>
      <CardContent>
        {caseData.activities && caseData.activities.length > 0 ? (
          <div className="space-y-4">
            {caseData.activities.slice(0, 20).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {getUserInitials(activity.user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {getUserName(activity.user)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(activity.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description || activity.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay actividades registradas</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}