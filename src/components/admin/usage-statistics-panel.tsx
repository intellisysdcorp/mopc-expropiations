'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function UsageStatisticsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Estadísticas de Uso</h2>
        <p className="text-muted-foreground">
          Visualiza las estadísticas de uso del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estadísticas del Sistema</CardTitle>
          <CardDescription>
            Analiza el uso y rendimiento del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de estadísticas de uso en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}