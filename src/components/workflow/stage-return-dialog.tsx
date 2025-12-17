'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RotateCcw, AlertTriangle, Info, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AvailableStage {
  stage: string;
  name: string;
  description: string;
  sequenceOrder: number;
  responsibleDepartment: string;
  lastVisitDate?: Date;
  visitCount: number;
  recentReturnCount: number;
  isRecommended: boolean;
  warning?: string;
}

interface RecentReturn {
  toStage: string;
  toStageName: string;
  reason: string;
  observations: string;
  createdAt: Date;
  createdBy: string;
}

interface StageReturnDialogProps {
  caseId: string;
  currentStage: string;
  onReturnComplete?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function StageReturnDialog({
  caseId,
  onReturnComplete,
  children,
  className
}: StageReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [availableStages, setAvailableStages] = useState<AvailableStage[]>([]);
  const [recentReturns, setRecentReturns] = useState<RecentReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [reason, setReason] = useState('');
  const [observations, setObservations] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [notifyStakeholders, setNotifyStakeholders] = useState(true);

 const fetchReturnOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseId}/stage-return`);

      if (!response.ok) {
        throw new Error('Failed to fetch return options');
      }

      const data = await response.json();
      setAvailableStages(data.availableStages);
      setRecentReturns(data.recentReturns);

      // Auto-select the most recent completed stage if available
      if (data.availableStages.length > 0) {
        const mostRecentStage = data.availableStages[data.availableStages.length - 1];
        setSelectedStage(mostRecentStage.stage);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (open) {
      fetchReturnOptions();
    }
  }, [fetchReturnOptions, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStage || !reason.trim() || !observations.trim()) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/cases/${caseId}/stage-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toStage: selectedStage,
          reason: reason.trim(),
          observations: observations.trim(),
          priority,
          requiresApproval,
          notifyStakeholders,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to return case');
      }

      await response.json();

      toast.success('Caso devuelto exitosamente');
      setOpen(false);
      resetForm();

      if (onReturnComplete) {
        onReturnComplete();
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al devolver el caso');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedStage('');
    setReason('');
    setObservations('');
    setPriority('high');
    setRequiresApproval(true);
    setNotifyStakeholders(true);
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
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

  const selectedStageData = availableStages.find(s => s.stage === selectedStage);

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" className={className}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Devolver Etapa
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Devolver Caso a Etapa Anterior
            </DialogTitle>
            <DialogDescription>
              Seleccione la etapa a la que desea devolver el caso y proporcione las observaciones necesarias.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Recent Returns Warning */}
              {recentReturns.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Este caso ha sido devuelto {recentReturns.length} veces en los últimos 7 días.
                    Considere si esta devolución es realmente necesaria.
                  </AlertDescription>
                </Alert>
              )}

              {/* Stage Selection */}
              <div className="space-y-3">
                <Label htmlFor="stage">Etapa de Destino *</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la etapa a la que desea devolver" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStages.map((stage) => (
                      <SelectItem key={stage.stage} value={stage.stage}>
                        <div className="flex items-center gap-2">
                          <span>{stage.name}</span>
                          {stage.isRecommended && (
                            <Badge variant="secondary" className="text-xs">
                              Recomendado
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedStageData && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">{selectedStageData.name}</h4>
                        <p className="text-sm text-gray-600">{selectedStageData.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Departamento: {selectedStageData.responsibleDepartment}</span>
                          {selectedStageData.visitCount > 0 && (
                            <span>Visitado {selectedStageData.visitCount} veces</span>
                          )}
                        </div>
                        {selectedStageData.warning && (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {selectedStageData.warning}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo de Devolución *</Label>
                <Textarea
                  id="reason"
                  placeholder="Explique brevemente por qué se devuelve el caso a esta etapa..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  minLength={10}
                />
                <p className="text-xs text-gray-500">
                  Mínimo 10 caracteres
                </p>
              </div>

              {/* Observations */}
              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones Detalladas *</Label>
                <Textarea
                  id="observations"
                  placeholder="Proporcione observaciones detalladas sobre lo que se debe corregir o completar en la etapa de destino..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={5}
                  required
                  minLength={20}
                />
                <p className="text-xs text-gray-500">
                  Mínimo 20 caracteres. Sea específico sobre las acciones requeridas.
                </p>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requiresApproval"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="requiresApproval" className="text-sm">
                    Requiere aprobación de supervisor
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="notifyStakeholders"
                    checked={notifyStakeholders}
                    onChange={(e) => setNotifyStakeholders(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="notifyStakeholders" className="text-sm">
                    Notificar a los interesados
                  </Label>
                </div>
              </div>

              {/* Recent Returns History */}
              {recentReturns.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Devoluciones Recientes</h4>
                    <div className="space-y-2">
                      {recentReturns.map((returnItem, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              {returnItem.toStageName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(returnItem.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">
                            <strong>Motivo:</strong> {returnItem.reason}
                          </p>
                          {returnItem.observations && (
                            <p className="text-xs text-gray-600">
                              <strong>Observaciones:</strong> {returnItem.observations}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={submitting || !selectedStage || !reason.trim() || !observations.trim()}
                >
                  {submitting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Devolver Caso
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}