'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function TemplateManagementPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestión de Plantillas</h2>
        <p className="text-muted-foreground">
          Gestiona las plantillas del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plantillas del Sistema</CardTitle>
          <CardDescription>
            Administra las plantillas de correo, documentos y notificaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de gestión de plantillas en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}