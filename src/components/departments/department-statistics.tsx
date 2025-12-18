'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Briefcase,
  TrendingUp,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  Target,
} from 'lucide-react';

interface DepartmentStatistics {
  department: {
    id: string;
    name: string;
    code: string;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    roleDistribution: Array<{
      roleId: string;
      roleName: string;
      count: number;
    }>;
    recentActivity: number;
  };
  cases: {
    total: number;
    active: number;
    completed: number;
    byStage: Array<{
      stage: string;
      count: number;
    }>;
    byPriority: Array<{
      priority: string;
      count: number;
    }>;
    recentActivity: number;
  };
  workflow: {
    assignedStages: Array<{
      stage: string;
      assignedAt: string;
    }>;
  };
  performance: {
    userSatisfaction: number;
    averageResolutionTime: number;
    caseCompletionRate: number;
    userUtilizationRate: number;
  };
  trends: Array<{
    month: string;
    newUsers: number;
    newCases: number;
    completedCases: number;
  }>;
  generatedAt: string;
}

interface DepartmentStatisticsProps {
  departmentId: string;
  refreshInterval?: number;
}

export function DepartmentStatistics({ departmentId, refreshInterval: _refreshInterval = 30000 }: DepartmentStatisticsProps) {
  const [statistics, setStatistics] = useState<DepartmentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/departments/${departmentId}/statistics`);

      if (!response.ok) {
        throw new Error('Error al cargar estadísticas');
      }

      const data = await response.json();
      setStatistics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !statistics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Error al cargar estadísticas</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <button
              onClick={fetchStatistics}
              className="text-primary hover:underline text-sm"
            >
              Reintentar
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { department, users, cases, workflow, performance, trends } = statistics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estadísticas de {department.name}</h2>
          <p className="text-muted-foreground">
            Código: {department.code} • Actualizado: {new Date(statistics.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={fetchStatistics}
          className="text-primary hover:underline text-sm"
        >
          Actualizar
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users Stats */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuarios</p>
                <p className="text-2xl font-bold">{users.total}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" className="text-xs">
                    {users.active} activos
                  </Badge>
                  {users.suspended > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {users.suspended} suspendidos
                    </Badge>
                  )}
                </div>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Cases Stats */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Casos</p>
                <p className="text-2xl font-bold">{cases.total}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" className="text-xs">
                    {cases.active} activos
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {cases.completed} completados
                  </Badge>
                </div>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tasa de Completación</p>
                <p className="text-2xl font-bold">{performance.caseCompletionRate}%</p>
                <Progress value={performance.caseCompletionRate} className="mt-2" />
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Time */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiempo Promedio</p>
                <p className="text-2xl font-bold">{performance.averageResolutionTime}d</p>
                <p className="text-xs text-muted-foreground mt-1">días para resolver</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución de Roles
            </CardTitle>
            <CardDescription>
              Usuarios por rol en el departamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.roleDistribution.map((role) => {
                const percentage = users.total > 0 ? (role.count / users.total) * 100 : 0;
                return (
                  <div key={role.roleId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{role.roleName}</span>
                      <span className="text-sm text-muted-foreground">
                        {role.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Case Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Casos por Etapa
            </CardTitle>
            <CardDescription>
              Distribución de casos actuales por etapa del proceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cases.byStage.map((stage) => {
                const percentage = cases.total > 0 ? (stage.count / cases.total) * 100 : 0;
                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{stage.stage}</span>
                      <span className="text-sm text-muted-foreground">
                        {stage.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencias Mensuales
            </CardTitle>
            <CardDescription>
            Últimos 12 meses de actividad del departamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium">
                <div>Mes</div>
                <div className="text-center">Usuarios</div>
                <div className="text-center">Casos</div>
                <div className="text-center">Completados</div>
                <div className="col-span-9 text-center">Gráfica</div>
              </div>

              {trends.map((trend) => {
                const maxUsers = Math.max(...trends.map(t => t.newUsers));
                const maxCases = Math.max(...trends.map(t => t.newCases));
                const maxCompleted = Math.max(...trends.map(t => t.completedCases));
                const maxValue = Math.max(maxUsers, maxCases, maxCompleted);

                return (
                  <div key={trend.month} className="grid grid-cols-12 gap-2 items-center">
                    <div className="text-sm font-medium">{trend.month}</div>
                    <div className="text-center text-sm">{trend.newUsers}</div>
                    <div className="text-center text-sm">{trend.newCases}</div>
                    <div className="text-center text-sm">{trend.completedCases}</div>
                    <div className="col-span-9 flex items-center gap-1">
                      <div
                        className="bg-blue-500/20 h-6 rounded"
                        style={{ width: `${(trend.newUsers / maxValue) * 100}%` }}
                        title={`Nuevos usuarios: ${trend.newUsers}`}
                      />
                      <div
                        className="bg-green-500/20 h-6 rounded"
                        style={{ width: `${(trend.newCases / maxValue) * 100}%` }}
                        title={`Nuevos casos: ${trend.newCases}`}
                      />
                      <div
                        className="bg-purple-500/20 h-6 rounded"
                        style={{ width: `${(trend.completedCases / maxValue) * 100}%` }}
                        title={`Casos completados: ${trend.completedCases}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500/20 rounded"></div>
                <span>Nuevos usuarios</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500/20 rounded"></div>
                <span>Nuevos casos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500/20 rounded"></div>
                <span>Casos completados</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assigned Stages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Etapas Asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            {workflow.assignedStages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {workflow.assignedStages.map((stage, index) => (
                  <Badge key={index} variant="outline">
                    {stage.stage}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No hay etapas asignadas a este departamento
              </p>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métricas de Rendimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Satisfacción del usuario</span>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-sm ${
                        i < Math.floor(performance.userSatisfaction)
                          ? 'bg-yellow-400'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{performance.userSatisfaction}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Utilización de usuarios</span>
              <span className="text-sm font-medium">{performance.userUtilizationRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Actividad de usuarios</span>
              <span className="text-sm font-medium">{users.recentActivity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Actividad de casos</span>
              <span className="text-sm font-medium">{cases.recentActivity}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 días
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}