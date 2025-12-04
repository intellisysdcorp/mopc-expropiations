'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  Info,
  BarChart3,
  Eye,
  Settings,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface Stage {
  stage: string;
  name: string;
  description: string;
  sequenceOrder: number;
  responsibleDepartment: string;
  estimatedDuration: number;
  isActive: boolean;
}

interface StageProgression {
  id: string;
  fromStage?: string;
  toStage: string;
  progressionType: 'FORWARD' | 'BACKWARD' | 'JUMP';
  reason?: string;
  observations?: string;
  approvedBy?: string;
  approvedAt?: Date;
  duration?: number;
  createdAt: Date;
}

interface StageProgressionControlProps {
  caseId: string;
  currentStage: string;
  caseStatus: string;
  onStageChange?: () => void;
  className?: string;
}

export function StageProgressionControl({
  caseId,
  currentStage,
  caseStatus,
  onStageChange,
  className
}: StageProgressionControlProps) {
  const [availableStages, setAvailableStages] = useState<Stage[]>([]);
  const [progressions, setProgressions] = useState<StageProgression[]>([]);
  const [loading, _setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [progressionDialog, setProgressionDialog] = useState(false);
  const [selectedStage, setSelectedStage] = useState('');
  const [reason, setReason] = useState('');
  const [observations, setObservations] = useState('');
  const [progressionType, setProgressionType] = useState<'FORWARD' | 'BACKWARD'>('FORWARD');

  const fetchStages = useCallback(async () => {
    try {
      const response = await fetch('/api/stages');

      if (!response.ok) {
        throw new Error('Failed to fetch stages');
      }

      const stages = await response.json();
      setAvailableStages(stages);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching stages:', error);
      }
    }
  }, []);

  const fetchProgressions = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/stage-progression`);

      if (!response.ok) {
        throw new Error('Failed to fetch progressions');
      }

      const data = await response.json();
      setProgressions(data.progressions);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching progressions:', error);
      }
    }
  }, [caseId]);

  useEffect(() => {
    fetchStages();
    fetchProgressions();
  }, [fetchStages, fetchProgressions]);

  const handleProgression = async () => {
    if (!selectedStage || !reason.trim()) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/cases/${caseId}/stage-progression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: progressionType === 'BACKWARD' ? 'return' : 'progress',
          toStage: selectedStage,
          reason: reason.trim(),
          observations: observations.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to progress stage');
      }

      await response.json();

      toast.success(
        progressionType === 'BACKWARD'
          ? 'Caso devuelto exitosamente'
          : 'Caso avanzado a la siguiente etapa'
      );

      setProgressionDialog(false);
      resetForm();

      if (onStageChange) {
        onStageChange();
      }

      // Refresh data
      await fetchProgressions();

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la progresión');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedStage('');
    setReason('');
    setObservations('');
    setProgressionType('FORWARD');
    setError(null);
  };

  const getNextStage = () => {
    const currentStageData = availableStages.find(s => s.stage === currentStage);
    if (!currentStageData) return null;

    return availableStages.find(s => s.sequenceOrder === currentStageData.sequenceOrder + 1);
  };

  const getPreviousStages = () => {
    const currentStageData = availableStages.find(s => s.stage === currentStage);
    if (!currentStageData) return [];

    return availableStages.filter(s => s.sequenceOrder < currentStageData.sequenceOrder);
  };

  const canProgressForward = () => {
    const nextStage = getNextStage();
    return nextStage && caseStatus !== 'COMPLETADO' && caseStatus !== 'CANCELLED';
  };

  const canProgressBackward = () => {
    const previousStages = getPreviousStages();
    return previousStages.length > 0 && caseStatus !== 'COMPLETADO' && caseStatus !== 'CANCELLED';
  };

  const getProgressionStats = () => {
    const totalProgressions = progressions.length;
    const forwardProgressions = progressions.filter(p => p.progressionType === 'FORWARD').length;
    const backwardProgressions = progressions.filter(p => p.progressionType === 'BACKWARD').length;
    const totalDuration = progressions.reduce((sum, p) => sum + (p.duration || 0), 0);

    return {
      total: totalProgressions,
      forward: forwardProgressions,
      backward: backwardProgressions,
      averageDuration: totalProgressions > 0 ? Math.round(totalDuration / totalProgressions) : 0
    };
  };

  const currentStageData = availableStages.find(s => s.stage === currentStage);
  const nextStage = getNextStage();
  const previousStages = getPreviousStages();
  const stats = getProgressionStats();

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Control de Progresión
              </CardTitle>
              <CardDescription>
                Gestiona el avance del caso a través de las etapas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={caseStatus === 'COMPLETADO' ? 'default' : 'secondary'}>
                {caseStatus}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProgressions}
                disabled={loading}
              >
                <Eye className="h-4 w-4 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Stage Info */}
          {currentStageData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-900">Etapa Actual</h3>
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  {currentStageData.responsibleDepartment}
                </Badge>
              </div>
              <h4 className="font-medium text-blue-800 mb-1">{currentStageData.name}</h4>
              <p className="text-sm text-blue-700 mb-2">{currentStageData.description}</p>
              <div className="flex items-center gap-4 text-xs text-blue-600">
                <span>Orden: {currentStageData.sequenceOrder} de 17</span>
                {currentStageData.estimatedDuration > 0 && (
                  <span>Duración estimada: {currentStageData.estimatedDuration} días</span>
                )}
              </div>
            </div>
          )}

          {/* Progression Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Total de Cambios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.forward}
              </div>
              <div className="text-sm text-gray-600">Avances</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.backward}
              </div>
              <div className="text-sm text-gray-600">Devueltos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats.averageDuration}d
              </div>
              <div className="text-sm text-gray-600">Duración Promedio</div>
            </div>
          </div>

          {/* Progression Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Forward Progression */}
            {canProgressForward() && nextStage && (
              <Button
                onClick={() => {
                  setSelectedStage(nextStage.stage);
                  setProgressionType('FORWARD');
                  setProgressionDialog(true);
                }}
                className="flex-1"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Avanzar a {nextStage.name}
              </Button>
            )}

            {/* Backward Progression */}
            {canProgressBackward() && (
              <Button
                variant="outline"
                onClick={() => {
                  setProgressionType('BACKWARD');
                  setProgressionDialog(true);
                }}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Devolver a Etapa Anterior
              </Button>
            )}

            {/* View Timeline */}
            <Button
              variant="outline"
              onClick={() => {
                // Open timeline view or navigate to timeline
                window.location.href = `/cases/${caseId}#timeline`;
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Ver Línea de Tiempo
            </Button>
          </div>

          {/* Recent Progressions */}
          {progressions.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Cambios Recientes</h4>
              <div className="space-y-2">
                {progressions.slice(0, 5).map((progression) => (
                  <div
                    key={progression.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {progression.progressionType === 'FORWARD' ? (
                        <ArrowRight className="h-4 w-4 text-green-500" />
                      ) : progression.progressionType === 'BACKWARD' ? (
                        <RotateCcw className="h-4 w-4 text-orange-500" />
                      ) : (
                        <Settings className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {progression.progressionType === 'FORWARD' ? 'Avanzado a' :
                           progression.progressionType === 'BACKWARD' ? 'Devuelto a' :
                           'Movido a'} {progression.toStage}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(progression.createdAt).toLocaleDateString('es-DO')}
                        </span>
                      </div>
                      {progression.reason && (
                        <p className="text-xs text-gray-600">{progression.reason}</p>
                      )}
                      {progression.duration && (
                        <span className="text-xs text-gray-500">
                          Duración: {progression.duration} días
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {stats.backward > stats.forward && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este caso ha sido devuelto más veces de las que ha avanzado. Considere revisar si hay problemas sistémicos o de comunicación.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Progression Dialog */}
      <Dialog open={progressionDialog} onOpenChange={setProgressionDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {progressionType === 'FORWARD' ? (
                <>
                  <ArrowRight className="h-5 w-5 text-green-500" />
                  Avanzar a Siguiente Etapa
                </>
              ) : (
                <>
                  <RotateCcw className="h-5 w-5 text-orange-500" />
                  Devolver a Etapa Anterior
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {progressionType === 'FORWARD'
                ? 'Seleccione la etapa a la que desea avanzar y proporcione el motivo del cambio.'
                : 'Seleccione la etapa a la que desea devolver el caso y proporcione observaciones detalladas.'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Stage Selection */}
            <div className="space-y-2">
              <Label htmlFor="stage">
                {progressionType === 'FORWARD' ? 'Siguiente Etapa' : 'Etapa de Destino'}
                *
              </Label>
              {progressionType === 'FORWARD' ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="font-medium">{nextStage?.name}</div>
                  <div className="text-sm text-gray-600">{nextStage?.description}</div>
                  <input type="hidden" value={nextStage?.stage} />
                </div>
              ) : (
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la etapa a la que desea devolver" />
                  </SelectTrigger>
                  <SelectContent>
                    {previousStages.map((stage) => (
                      <SelectItem key={stage.stage} value={stage.stage}>
                        <div>
                          <div className="font-medium">{stage.name}</div>
                          <div className="text-sm text-gray-500">{stage.responsibleDepartment}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Motivo {progressionType === 'FORWARD' ? 'del Avance' : 'de la Devolución'} *
              </Label>
              <Textarea
                id="reason"
                placeholder={progressionType === 'FORWARD'
                  ? 'Describa por qué el caso está listo para avanzar...'
                  : 'Explique por qué es necesario devolver el caso...'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* Observations */}
            {progressionType === 'BACKWARD' && (
              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones Detalladas</Label>
                <Textarea
                  id="observations"
                  placeholder="Proporcione observaciones específicas sobre lo que se debe corregir..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* Info */}
            {progressionType === 'FORWARD' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Asegúrese de que todos los requisitos de la etapa actual estén completados antes de avanzar.
                  El avance será registrado en el historial del caso.
                </AlertDescription>
              </Alert>
            )}

            {progressionType === 'BACKWARD' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  La devolución de un caso generará notificaciones a los responsables de la etapa de destino.
                  Utilice esta opción solo cuando sea realmente necesario.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProgressionDialog(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProgression}
              disabled={submitting || !selectedStage || !reason.trim()}
              variant={progressionType === 'BACKWARD' ? 'destructive' : 'default'}
            >
              {submitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : progressionType === 'FORWARD' ? (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Avanzar
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Devolver
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}