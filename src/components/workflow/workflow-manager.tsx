'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  TrendingUp,
  FileText,
  BarChart3,
  Activity,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

// Import workflow components
import { CaseTimeline } from './case-timeline';
import { ChecklistManager } from './checklist-manager';
import { StageProgressionControl } from './stage-progression-control';
import clientLogger from '@/lib/client-logger';

interface CaseData {
  id: string;
  fileNumber: string;
  title: string;
  description?: string;
  currentStage: string;
  status: string;
  priority: string;
  progressPercentage: number;
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  department: {
    id: string;
    name: string;
    code: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  supervisedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface WorkflowStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  averageProgress: number;
  overdueCases: number;
  stagesCompleted: number;
  averageStageTime: number;
  userWorkload: {
    assigned: number;
    supervised: number;
    completed: number;
  };
}

interface WorkflowManagerProps {
  caseId: string;
  className?: string;
}

export function WorkflowManager({ caseId, className }: WorkflowManagerProps) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [_refreshKey, setRefreshKey] = useState(0);

  const fetchCaseData = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch case data');
      }

      const data = await response.json();
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const fetchWorkflowStats = useCallback(async () => {
    try {
      // This would be a new API endpoint for workflow statistics
      const response = await fetch('/api/cases/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch workflow stats');
      }

      const data = await response.json();
      setWorkflowStats(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching workflow stats:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchCaseData();
    fetchWorkflowStats();
  }, [fetchCaseData, fetchWorkflowStats]);

  const handleStageChange = () => {
    // Refresh data when stage changes
    setRefreshKey(prev => prev + 1);
    fetchCaseData();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETADO':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'EN_PROGRESO':
        return 'bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200';
      case 'PENDIENTE':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'SUSPENDED':
        return 'bg-brand-orange-50 text-brand-orange-700 border-brand-orange-200';
      case 'CANCELLED':
        return 'bg-brand-red-50 text-brand-red-700 border-brand-red-200';
      default:
        return 'bg-gray-50 text-brand-gray-700 border-brand-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Gestión del Flujo de Trabajo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !caseData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Gestión del Flujo de Trabajo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-red-500">
            Error: {error || 'No se pudo cargar la información del caso'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión del Flujo de Trabajo</h1>
          <p className="text-gray-600">
            Caso {caseData.fileNumber} - {caseData.title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setRefreshKey(prev => prev + 1)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Case Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Información del Caso</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getStageStatusColor(caseData.status)}>
                {caseData.status}
              </Badge>
              <Badge className={getPriorityColor(caseData.priority)}>
                {caseData.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Case Details */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Número de Caso</h4>
                <p className="text-sm text-gray-600">{caseData.fileNumber}</p>
              </div>
              <div>
                <h4 className="font-medium">Departamento</h4>
                <p className="text-sm text-gray-600">{caseData.department.name}</p>
              </div>
              <div>
                <h4 className="font-medium">Fecha de Inicio</h4>
                <p className="text-sm text-gray-600">{formatDate(caseData.startDate)}</p>
              </div>
              {caseData.expectedEndDate && (
                <div>
                  <h4 className="font-medium">Fecha Estimada de Finalización</h4>
                  <p className="text-sm text-gray-600">{formatDate(caseData.expectedEndDate)}</p>
                </div>
              )}
            </div>

            {/* Assignment */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Creado por</h4>
                <p className="text-sm text-gray-600">
                  {caseData.createdBy.firstName} {caseData.createdBy.lastName}
                </p>
              </div>
              {caseData.assignedTo && (
                <div>
                  <h4 className="font-medium">Asignado a</h4>
                  <p className="text-sm text-gray-600">
                    {caseData.assignedTo.firstName} {caseData.assignedTo.lastName}
                  </p>
                </div>
              )}
              {caseData.supervisedBy && (
                <div>
                  <h4 className="font-medium">Supervisado por</h4>
                  <p className="text-sm text-gray-600">
                    {caseData.supervisedBy.firstName} {caseData.supervisedBy.lastName}
                  </p>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Progreso General</h4>
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Completado</span>
                    <span>{caseData.progressPercentage.toFixed(1)}%</span>
                  </div>
                  <Progress value={caseData.progressPercentage} className="h-2" />
                </div>
              </div>
              {workflowStats && (
                <div>
                  <h4 className="font-medium">Estadísticas del Flujo</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Tiempo promedio por etapa:</span>
                      <span>{workflowStats.averageStageTime} días</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Etapas completadas:</span>
                      <span>{workflowStats.stagesCompleted}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {caseData.description && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-2">Descripción</h4>
              <p className="text-sm text-gray-600">{caseData.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="progression" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Progresión
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Línea de Tiempo
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StageProgressionControl
              caseId={caseId}
              currentStage={caseData.currentStage}
              caseStatus={caseData.status}
              onStageChange={handleStageChange}
            />

            {workflowStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Estadísticas del Flujo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {workflowStats.totalCases}
                      </div>
                      <div className="text-sm text-gray-600">Total de Casos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {workflowStats.activeCases}
                      </div>
                      <div className="text-sm text-gray-600">Casos Activos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {workflowStats.averageProgress.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Progreso Promedio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {workflowStats.overdueCases}
                      </div>
                      <div className="text-sm text-gray-600">Casos Retrasados</div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="font-medium mb-3">Mi Carga de Trabajo</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Casos Asignados:</span>
                        <span className="font-medium">{workflowStats.userWorkload.assigned}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Casos Supervisados:</span>
                        <span className="font-medium">{workflowStats.userWorkload.supervised}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Casos Completados:</span>
                        <span className="font-medium">{workflowStats.userWorkload.completed}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => setActiveTab('timeline')}
                >
                  <Eye className="h-6 w-6 mb-2" />
                  <span className="text-sm">Ver Línea de Tiempo</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => setActiveTab('checklist')}
                >
                  <FileText className="h-6 w-6 mb-2" />
                  <span className="text-sm">Gestionar Checklist</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => setActiveTab('progression')}
                >
                  <TrendingUp className="h-6 w-6 mb-2" />
                  <span className="text-sm">Control de Progresión</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => {
                    // Export case data
                    window.open(`/api/cases/${caseId}/export`, '_blank');
                  }}
                >
                  <Download className="h-6 w-6 mb-2" />
                  <span className="text-sm">Exportar Datos</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progression Tab */}
        <TabsContent value="progression">
          <StageProgressionControl
            caseId={caseId}
            currentStage={caseData.currentStage}
            caseStatus={caseData.status}
            onStageChange={handleStageChange}
          />
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist">
          <ChecklistManager
            caseId={caseId}
            onProgressComplete={() => {
              toast.success('Todos los items requeridos han sido completados');
              setActiveTab('progression');
            }}
          />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <CaseTimeline caseId={caseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}