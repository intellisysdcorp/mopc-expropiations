'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function PerformanceMonitoringPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Monitoreo de Rendimiento</h2>
        <p className="text-muted-foreground">
          Monitorea el rendimiento del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Métricas de Rendimiento</CardTitle>
          <CardDescription>
            Visualiza las métricas de rendimiento del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de monitoreo de rendimiento en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}