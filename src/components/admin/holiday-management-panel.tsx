'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HolidayManagementPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestión de Festivos</h2>
        <p className="text-muted-foreground">
          Administra los festivos y días no laborables
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendario de Festivos</CardTitle>
          <CardDescription>
            Gestiona los festivos y días no laborables del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de gestión de festivos en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}