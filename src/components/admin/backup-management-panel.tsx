'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function BackupManagementPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestión de Backup</h2>
        <p className="text-muted-foreground">
          Configura y gestiona los backups del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Backup</CardTitle>
          <CardDescription>
            Administra las configuraciones de backup y restauración
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de gestión de backup en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}