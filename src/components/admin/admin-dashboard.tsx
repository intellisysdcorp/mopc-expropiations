'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  FileText,
  Activity,
  Calendar,
  Shield,
  BarChart3,
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react'

// Import sub-components
import { SystemConfigurationPanel } from './system-configuration-panel'
import { TemplateManagementPanel } from './template-management-panel'
import { BackupManagementPanel } from './backup-management-panel'
import { SystemLogsPanel } from './system-logs-panel'
import { PerformanceMonitoringPanel } from './performance-monitoring-panel'
import { HolidayManagementPanel } from './holiday-management-panel'
import { SecurityConfigurationPanel } from './security-configuration-panel'
import { UsageStatisticsPanel } from './usage-statistics-panel'
import { AdminDashboardSkeleton } from './admin-dashboard-skeleton'
import clientLogger from '@/lib/client-logger';
import { Database } from 'lucide-react'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalCases: number
  pendingCases: number
  systemHealth: 'healthy' | 'warning' | 'critical'
  lastBackup: string | null
  uptime: string
  databaseSize: string
  errorRate: number
}

interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  timestamp: string
  isRead: boolean
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchSystemStats()
    fetchSystemAlerts()

    // Set up real-time updates
    const interval = setInterval(fetchSystemStats, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSystemStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching system stats:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchSystemAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.slice(0, 5)) // Show only latest 5 alerts
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching system alerts:', error)
      }
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-600" />
      default: return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeUsers || 0} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Totales</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCases || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingCases || 0} pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salud del Sistema</CardTitle>
            {stats ? getHealthIcon(stats.systemHealth) : <Clock className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats ? getHealthColor(stats.systemHealth) : ''}`}>
              {stats?.systemHealth === 'healthy' ? 'Saludable' :
               stats?.systemHealth === 'warning' ? 'Advertencia' :
               stats?.systemHealth === 'critical' ? 'Crítico' : 'Desconocido'}
            </div>
            <p className="text-xs text-muted-foreground">
              Tiempo activo: {stats?.uptime || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastBackup ?
                new Date(stats.lastBackup).toLocaleDateString() :
                'Nunca'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Tamaño: {stats?.databaseSize || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {alert.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    {alert.type === 'info' && <Bell className="h-4 w-4 text-blue-600" />}
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    {!alert.isRead && (
                      <Badge variant="secondary" className="text-xs">
                        Nuevo
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Panels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
          <TabsTrigger value="overview" className="hidden">Overview</TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuración</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Plantillas</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Rendimiento</span>
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Festivos</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Seguridad</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Estadísticas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <SystemConfigurationPanel />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateManagementPanel />
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <BackupManagementPanel />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <SystemLogsPanel />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceMonitoringPanel />
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <HolidayManagementPanel />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityConfigurationPanel />
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <UsageStatisticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}