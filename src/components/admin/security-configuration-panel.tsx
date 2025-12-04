'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SecurityConfigurationPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuración de Seguridad</h2>
        <p className="text-muted-foreground">
          Configura las políticas de seguridad del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Políticas de Seguridad</CardTitle>
          <CardDescription>
            Administra las políticas de seguridad y cumplimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Panel de configuración de seguridad en desarrollo...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}