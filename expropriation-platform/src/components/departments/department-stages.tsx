'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'react-hot-toast';
import {
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Pause,
  BarChart3,
  Users,
  FileText,
  ArrowRight,
  TrendingUp,
  Calendar,
  Activity,
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

interface StageAssignment {
  id: string;
  stage: string;
  assignedAt: string;
  assignedBy?: string;
}

interface StageStatistics {
  stage: string;
  count: number;
  isAssigned: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentStagesProps {
  departmentId: string;
  department: Department;
  onStagesUpdated?: () => void;
}

const CASE_STAGES = [
  'INITIAL_REVIEW',
  'LEGAL_REVIEW',
  'TECHNICAL_EVALUATION',
  'APPRAISAL',
  'NEGOTIATION',
  'DOCUMENTATION',
  'PUBLIC_CONSULTATION',
  'APPROVAL',
  'PAYMENT',
  'TRANSFER',
  'FINAL_CLOSURE',
  'QUALITY_CONTROL',
  'AUDIT',
  'REPORTING',
  'ARCHIVE_PREPARATION',
  'COMPLETED',
  'SUSPENDED',
  'CANCELLED',
] as const;

const STAGE_DESCRIPTIONS: Record<string, string> = {
  INITIAL_REVIEW: 'Revisión inicial del caso y verificación de requisitos básicos',
  LEGAL_REVIEW: 'Evaluación legal de los documentos y procedimientos',
  TECHNICAL_EVALUATION: 'Análisis técnico de la propiedad y valoración',
  APPRAISAL: 'Valoración formal de la propiedad por peritos',
  NEGOTIATION: 'Negociación de términos y compensación',
  DOCUMENTATION: 'Preparación y formalización de documentos',
  PUBLIC_CONSULTATION: 'Período de consulta pública y notificaciones',
  APPROVAL: 'Aprobación final de la expropiación',
  PAYMENT: 'Procesamiento de pagos y compensaciones',
  TRANSFER: 'Transferencia legal de la propiedad',
  FINAL_CLOSURE: 'Cierre final del caso',
  QUALITY_CONTROL: 'Control de calidad y revisión final',
  AUDIT: 'Auditoría del proceso y documentación',
  REPORTING: 'Generación de reportes finales',
  ARCHIVE_PREPARATION: 'Preparación para archivo',
  COMPLETED: 'Caso completado exitosamente',
  SUSPENDED: 'Caso suspendido temporalmente',
  CANCELLED: 'Caso cancelado',
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  INITIAL_REVIEW: <Search className="h-4 w-4" />,
  LEGAL_REVIEW: <FileText className="h-4 w-4" />,
  TECHNICAL_EVALUATION: <BarChart3 className="h-4 w-4" />,
  APPRAISAL: <TrendingUp className="h-4 w-4" />,
  NEGOTIATION: <Users className="h-4 w-4" />,
  DOCUMENTATION: <FileText className="h-4 w-4" />,
  PUBLIC_CONSULTATION: <Users className="h-4 w-4" />,
  APPROVAL: <CheckCircle2 className="h-4 w-4" />,
  PAYMENT: <Activity className="h-4 w-4" />,
  TRANSFER: <ArrowRight className="h-4 w-4" />,
  FINAL_CLOSURE: <CheckCircle2 className="h-4 w-4" />,
  QUALITY_CONTROL: <BarChart3 className="h-4 w-4" />,
  AUDIT: <FileText className="h-4 w-4" />,
  REPORTING: <BarChart3 className="h-4 w-4" />,
  ARCHIVE_PREPARATION: <FileText className="h-4 w-4" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  SUSPENDED: <Pause className="h-4 w-4" />,
  CANCELLED: <AlertTriangle className="h-4 w-4" />,
};

const getStageDisplayName = (stage: string) => {
  const names: Record<string, string> = {
    INITIAL_REVIEW: 'Revisión Inicial',
    LEGAL_REVIEW: 'Revisión Legal',
    TECHNICAL_EVALUATION: 'Evaluación Técnica',
    APPRAISAL: 'Avaluó',
    NEGOTIATION: 'Negociación',
    DOCUMENTATION: 'Documentación',
    PUBLIC_CONSULTATION: 'Consulta Pública',
    APPROVAL: 'Aprobación',
    PAYMENT: 'Pago',
    TRANSFER: 'Transferencia',
    FINAL_CLOSURE: 'Cierre Final',
    QUALITY_CONTROL: 'Control de Calidad',
    AUDIT: 'Auditoría',
    REPORTING: 'Reportes',
    ARCHIVE_PREPARATION: 'Preparación de Archivo',
    COMPLETED: 'Completado',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Cancelado',
  };
  return names[stage] || stage;
};

const getStageCategory = (stage: string) => {
  if (['INITIAL_REVIEW', 'LEGAL_REVIEW', 'TECHNICAL_EVALUATION', 'APPRAISAL'].includes(stage)) {
    return 'Evaluación';
  }
  if (['NEGOTIATION', 'DOCUMENTATION', 'PUBLIC_CONSULTATION', 'APPROVAL'].includes(stage)) {
    return 'Proceso';
  }
  if (['PAYMENT', 'TRANSFER', 'FINAL_CLOSURE'].includes(stage)) {
    return 'Ejecución';
  }
  if (['QUALITY_CONTROL', 'AUDIT', 'REPORTING', 'ARCHIVE_PREPARATION'].includes(stage)) {
    return 'Cierre';
  }
  if (['COMPLETED', 'SUSPENDED', 'CANCELLED'].includes(stage)) {
    return 'Final';
  }
  return 'Otro';
};

export function DepartmentStages({
  departmentId,
  department,
  onStagesUpdated,
}: DepartmentStagesProps) {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<StageAssignment[]>([]);
  const [stageStatistics, setStageStatistics] = useState<StageStatistics[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('assigned');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [stageToRemove, setStageToRemove] = useState<string | null>(null);

  // Fetch stages data
  const fetchStages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/departments/${departmentId}/stages`);
      if (!response.ok) {throw new Error('Error fetching stages');}

      const data = await response.json();
      setAssignments(data.assignments || []);
      setStageStatistics(data.stageStatistics || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error('Error al cargar etapas');
        clientLogger.error('Error fetching stages:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  // Group stages by category
  const stagesByCategory = CASE_STAGES.reduce((acc, stage) => {
    const category = getStageCategory(stage);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(stage);
    return acc;
  }, {} as Record<string, string[]>);

  // Filter stages based on search
  const filteredCategories = Object.entries(stagesByCategory).filter(([category, stages]) =>
    category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stages.some(stage =>
      getStageDisplayName(stage).toLowerCase().includes(searchTerm.toLowerCase()) ||
      STAGE_DESCRIPTIONS[stage]?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Check if a stage is assigned
  const isStageAssigned = (stage: string) => {
    return assignments.some(a => a.stage === stage);
  };

  // Get stage statistics
  const getStageStats = (stage: string) => {
    return stageStatistics.find(s => s.stage === stage);
  };

  // Handle stage toggle
  const handleStageToggle = async (stage: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/stages/${stage}`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar etapa');
      }

      const result = await response.json();
      toast.success(result.message);
      await fetchStages();
      onStagesUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar etapa');
    }
  };

  // Handle bulk stage assignment
  const handleBulkAssignment = async () => {
    if (selectedStages.length === 0) {
      toast.error('Selecciona al menos una etapa');
      return;
    }

    try {
      const response = await fetch(`/api/departments/${departmentId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: selectedStages }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en asignación masiva');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowBulkDialog(false);
      setSelectedStages([]);
      await fetchStages();
      onStagesUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error en asignación masiva');
    }
  };

  // Handle stage removal
  const handleRemoveStage = async (stage: string) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/stages/${stage}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar etapa');
      }

      const result = await response.json();
      toast.success(result.message);
      setShowRemoveDialog(false);
      setStageToRemove(null);
      await fetchStages();
      onStagesUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar etapa');
    }
  };

  // Calculate statistics
  const stats = {
    assigned: assignments.length,
    total: CASE_STAGES.length,
    withCases: stageStatistics.filter(s => s.count > 0).length,
    totalCases: stageStatistics.reduce((sum, s) => sum + s.count, 0),
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Etapas del Proceso
          </h2>
          <p className="text-muted-foreground">
            {department.name} ({department.code})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchStages}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {selectedStages.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(true)}
            >
              Asignar {selectedStages.length} etapa(s)
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Etapas Asignadas</p>
                <p className="text-2xl font-bold">{stats.assigned}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Disponibles</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Con Casos Activos</p>
                <p className="text-2xl font-bold">{stats.withCases}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Casos</p>
                <p className="text-2xl font-bold">{stats.totalCases}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Progreso de Asignación</CardTitle>
          <CardDescription>
            Visualización del progreso de asignación de etapas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Etapas Asignadas</span>
                <span className="text-sm text-muted-foreground">
                  {stats.assigned} de {stats.total}
                </span>
              </div>
              <Progress value={(stats.assigned / stats.total) * 100} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assigned">Etapas Asignadas</TabsTrigger>
          <TabsTrigger value="available">Todas las Etapas</TabsTrigger>
        </TabsList>

        {/* Assigned Stages */}
        <TabsContent value="assigned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Etapas Asignadas al Departamento
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar etapas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardTitle>
              <CardDescription>
                Etapas del proceso que este departamento puede gestionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Workflow className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay etapas asignadas</h3>
                  <p className="text-muted-foreground mb-4">
                    Este departamento no tiene etapas del proceso asignadas
                  </p>
                  <Button onClick={() => setActiveTab('available')}>
                    Asignar Etapas
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {assignments.map((assignment) => {
                    const stats = getStageStats(assignment.stage);
                    const stageName = getStageDisplayName(assignment.stage);
                    const category = getStageCategory(assignment.stage);

                    return (
                      <Card key={assignment.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="p-3 bg-primary/10 rounded-lg">
                                {STAGE_ICONS[assignment.stage] || <Workflow className="h-6 w-6" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-lg font-semibold">{stageName}</h3>
                                  <Badge variant="outline">{category}</Badge>
                                </div>
                                {STAGE_DESCRIPTIONS[assignment.stage] && (
                                  <p className="text-muted-foreground mb-3">
                                    {STAGE_DESCRIPTIONS[assignment.stage]}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    {stats?.count || 0} casos activos
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Asignada: {new Date(assignment.assignedAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStageToggle(assignment.stage)}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Desactivar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStageToRemove(assignment.stage);
                                  setShowRemoveDialog(true);
                                }}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Available Stages */}
        <TabsContent value="available" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Todas las Etapas del Proceso
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar etapas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardTitle>
              <CardDescription>
                Selecciona las etapas que este departamento podrá gestionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredCategories.map(([category, stages]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold">{category}</h3>
                      <Badge variant="outline">{stages.length} etapas</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stages.map((stage) => {
                        const isAssigned = isStageAssigned(stage);
                        const stats = getStageStats(stage);
                        const stageName = getStageDisplayName(stage);
                        const isSelected = selectedStages.includes(stage);

                        return (
                          <Card key={stage} className={isSelected ? 'ring-2 ring-primary' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedStages(prev => [...prev, stage]);
                                      } else {
                                        setSelectedStages(prev => prev.filter(s => s !== stage));
                                      }
                                    }}
                                    disabled={isAssigned}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{stageName}</span>
                                      {isAssigned && (
                                        <Badge variant="secondary" className="text-xs">
                                          Asignada
                                        </Badge>
                                      )}
                                      {stats && stats.count > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          {stats.count} casos
                                        </Badge>
                                      )}
                                    </div>
                                    {STAGE_DESCRIPTIONS[stage] && (
                                      <p className="text-sm text-muted-foreground">
                                        {STAGE_DESCRIPTIONS[stage]}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {STAGE_ICONS[stage]}
                                  {isAssigned ? (
                                    <Switch
                                      checked={true}
                                      onCheckedChange={() => handleStageToggle(stage)}
                                    />
                                  ) : (
                                    <Switch
                                      checked={false}
                                      onCheckedChange={() => handleStageToggle(stage)}
                                    />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Assignment Dialog */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar Etapas</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas asignar {selectedStages.length} etapa(s) al departamento &quot;{department.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Etapas a asignar:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedStages.map((stage) => (
                  <Badge key={stage} variant="outline">
                    {getStageDisplayName(stage)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAssignment}>
              Asignar Etapas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Stage Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la etapa &quot;{stageToRemove ? getStageDisplayName(stageToRemove) : ''}&quot; del departamento &quot;{department.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stageToRemove && handleRemoveStage(stageToRemove)}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}