'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import clientLogger from '@/lib/client-logger';

interface DashboardStats {
  overview: {
    totalCases: number;
    activeCases: number;
    completedCases: number;
    pendingCases: number;
    inProgressCases: number;
    overdueCases: number;
    totalUsers: number;
    activeUsers: number;
    totalDepartments: number;
    avgCompletionTime: number;
    monthlyTrend: number;
    monthlyTrendPercent: number;
  };
  distributions: {
    priority: Array<{ name: string; value: number }>;
    status: Array<{ name: string; value: number }>;
    stage: Array<{ name: string; value: number }>;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

function StatCard({
  title,
  value,
  description,
  trend,
  trendLabel,
  icon,
  variant = 'default'
}: StatCardProps) {
  const getVariantColors = () => {
    switch (variant) {
      case 'warning':
        return 'border-orange-200 bg-orange-50';
      case 'danger':
        return 'border-red-200 bg-red-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getIconColors = () => {
    switch (variant) {
      case 'warning':
        return 'text-orange-600';
      case 'danger':
        return 'text-red-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <Card className={`transition-all hover:shadow-md ${getVariantColors()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={getIconColors()}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend !== undefined && (
          <div className="flex items-center mt-2">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
            ) : trend < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
            ) : null}
            <span className={`text-xs ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend > 0 ? '+' : ''}{trend}% {trendLabel || 'vs. último mes'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardStats({ departmentId }: { departmentId?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (departmentId) params.append('departmentId', departmentId);

      const response = await fetch(`/api/dashboard/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();

      // Handle API response structure: { success: true, data: {...}, distributions: {...} }
      if (data.success && data.data && data.distributions) {
        // Transform the API response to match the component's expected structure
        const transformedData: DashboardStats = {
          overview: data.data,
          distributions: data.distributions
        };
        setStats(transformedData);
      } else {
        // Fallback for backward compatibility or different response structure
        setStats(data);
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
        clientLogger.error('Error fetching dashboard stats:', error);
      } else {
        setError('Error loading statistics');
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full">
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar estadísticas</h3>
            <p className="text-sm mb-4">{error}</p>
            <Button onClick={fetchStats} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Last updated indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mr-2" />
          Última actualización: {format(lastUpdated, 'dd/MM/yyyy HH:mm:ss')}
        </div>
        <Button
          onClick={fetchStats}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <Activity className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Casos Totales"
          value={stats.overview.totalCases.toLocaleString()}
          description="Total en el sistema"
          trend={stats.overview.monthlyTrendPercent}
          trendLabel="este mes"
          icon={<FileText className="h-4 w-4" />}
        />

        <StatCard
          title="Casos Activos"
          value={stats.overview.activeCases.toLocaleString()}
          description="En proceso actualmente"
          icon={<Activity className="h-4 w-4" />}
          variant="default"
        />

        <StatCard
          title="Casos Completados"
          value={stats.overview.completedCases.toLocaleString()}
          description="Finalizados exitosamente"
          icon={<CheckCircle className="h-4 w-4" />}
          variant="success"
        />

        <StatCard
          title="Casos Pendientes"
          value={stats.overview.pendingCases.toLocaleString()}
          description="Esperando acción"
          icon={<Clock className="h-4 w-4" />}
          variant={stats.overview.pendingCases > 20 ? 'warning' : 'default'}
        />

        <StatCard
          title="En Progreso"
          value={stats.overview.inProgressCases.toLocaleString()}
          description="Actualmente en revisión"
          icon={<Calendar className="h-4 w-4" />}
        />

        <StatCard
          title="Casos Vencidos"
          value={stats.overview.overdueCases.toLocaleString()}
          description="Pasaron la fecha límite"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.overview.overdueCases > 0 ? 'danger' : 'default'}
        />

        <StatCard
          title="Usuarios Activos"
          value={`${stats.overview.activeUsers}/${stats.overview.totalUsers}`}
          description="Últimos 30 días"
          icon={<Users className="h-4 w-4" />}
        />

        <StatCard
          title="Departamentos"
          value={stats.overview.totalDepartments}
          description="Unidades activas"
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      {/* Distribution Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.distributions.priority.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <Badge
                    variant={
                      item.name === 'URGENT' ? 'destructive' :
                      item.name === 'HIGH' ? 'destructive' :
                      item.name === 'MEDIUM' ? 'secondary' :
                      'outline'
                    }
                    className="text-xs"
                  >
                    {item.name}
                  </Badge>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.distributions.status.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <Badge
                    variant={
                      item.name === 'COMPLETADO' ? 'default' :
                      item.name === 'EN_PROGRESO' ? 'secondary' :
                      item.name === 'PENDIENTE' ? 'outline' :
                      'destructive'
                    }
                    className="text-xs"
                  >
                    {item.name.replace('_', ' ')}
                  </Badge>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {stats.overview.avgCompletionTime}
              </div>
              <div className="text-sm text-muted-foreground">días para completar</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}