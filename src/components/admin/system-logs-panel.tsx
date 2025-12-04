'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SystemLogsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs del Sistema</h2>
        <p className="text-muted-foreground">
          Visualiza y filtra los logs del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs del Sistema</CardTitle>
          <CardDescription>
            Explora y filtra los logs del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de logs del sistema en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}