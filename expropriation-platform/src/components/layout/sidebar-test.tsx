'use client'

import { SidebarLayout, SidebarProvider } from './sidebar-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  BarChart3,
  FileText,
  Calendar,
  Users,
  Settings,
  Building2,
  FileImage,
} from 'lucide-react'

const moduleInfo = [
  {
    title: 'Panel Principal',
    href: '/dashboard',
    icon: BarChart3,
    description: 'Vista general del sistema con estadísticas y métricas clave.',
    features: ['Estadísticas en tiempo real', 'Alertas del sistema', 'Métricas de rendimiento']
  },
  {
    title: 'Gestión de Casos',
    href: '/cases',
    icon: FileText,
    description: 'Sistema completo para la gestión de casos de expropiación.',
    features: ['17 etapas de workflow', 'Asignación de casos', 'Seguimiento en tiempo real']
  },
  {
    title: 'Reuniones Técnicas',
    href: '/meetings',
    icon: Calendar,
    description: 'Planificación y gestión de reuniones técnicas.',
    features: ['Programación de reuniones', 'Actas digitales', 'Toma de decisiones']
  },
  {
    title: 'Reportes y Análisis',
    href: '/reports',
    icon: BarChart3,
    description: 'Generación de reportes y análisis de datos.',
    features: ['Reportes personalizados', 'Visualización de datos', 'Exportación']
  },
  {
    title: 'Gestión de Usuarios',
    href: '/users',
    icon: Users,
    description: 'Administración de usuarios y permisos.',
    features: ['Roles y permisos', 'Gestión por departamentos', 'Auditoría de accesos']
  },
  {
    title: 'Departamentos',
    href: '/departments',
    icon: Building2,
    description: 'Estructura jerárquica de departamentos.',
    features: ['Jerarquía departamental', 'Asignación de usuarios', 'Permisos por departamento']
  },
  {
    title: 'Gestión Documental',
    href: '/documents',
    icon: FileImage,
    description: 'Sistema de gestión de documentos con versionado.',
    features: ['Control de versiones', 'Firma digital', 'Almacenamiento seguro']
  },
  {
    title: 'Panel de Administración',
    href: '/admin',
    icon: Settings,
    description: 'Configuración avanzada del sistema.',
    features: ['Configuración del sistema', 'Backup y restore', 'Monitoreo']
  }
]

export function SidebarTest() {
  const { user, isSuperAdmin } = useAuth()

  return (
    <SidebarProvider>
      <SidebarLayout>
        <div className="p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold">Navegación Lateral - MOPC</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Sistema de gestión de casos de expropiación con navegación lateral intuitiva y responsive.
              </p>
              <div className="flex justify-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary">
                  Usuario: {user?.firstName} {user?.lastName}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary">
                  Rol: {user?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Module Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {moduleInfo.map((module) => {
                const hasPermission = !module.roles || module.roles.some(role => {
                  switch (role) {
                    case 'super_admin': return isSuperAdmin
                    default: return true
                  }
                })

                if (!hasPermission) return null

                const Icon = module.icon

                return (
                  <Card key={module.title} className="group hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {module.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {module.features.map((feature, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => window.location.href = module.href}
                      >
                        Acceder al Módulo
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Instrucciones de Navegación</CardTitle>
                <CardDescription>
                  Cómo usar la nueva navegación lateral del sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Navegación Desktop
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Haz clic en el menú lateral para navegar entre módulos</li>
                      <li>• Usa el botón ☰ para colapsar/expandir el sidebar</li>
                      <li>• Los sub-menús se despliegan automáticamente</li>
                      <li>• El estado activo se muestra con resaltado</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Navegación Móvil
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Toca el botón ☰ para abrir el menú</li>
                      <li>• El menú se muestra como overlay</li>
                      <li>• Toca fuera del menú para cerrarlo</li>
                      <li>• Navegación optimizada para touch</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarLayout>
    </SidebarProvider>
  )
}