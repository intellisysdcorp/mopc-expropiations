'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Circle,
  FileText,
  Clock,
  AlertTriangle,
  Eye,
  Calendar,
  File,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import clientLogger from '@/lib/client-logger';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  itemType: 'DOCUMENT' | 'ACTION' | 'VERIFICATION' | 'APPROVAL';
  sequence?: number;
  isActive: boolean;
  completion?: {
    id: string;
    isCompleted: boolean;
    completedAt?: Date;
    completedBy?: {
      id: string;
      name: string;
      email: string;
    };
    notes?: string;
    attachmentPath?: string;
  };
}

interface ChecklistStats {
  total: number;
  completed: number;
  pending: number;
  percentage: number;
  canProgress: boolean;
}

interface ChecklistManagerProps {
  caseId: string;
  stage?: string;
  onProgressComplete?: () => void;
  className?: string;
}

export function ChecklistManager({
  caseId,
  stage,
  onProgressComplete,
  className
}: ChecklistManagerProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [stats, setStats] = useState<ChecklistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [completionDialog, setCompletionDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [_attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const fetchChecklist = useCallback(async () => {
    try {
      setLoading(true);
      const url = stage
        ? `/api/cases/${caseId}/checklist?stage=${stage}`
        : `/api/cases/${caseId}/checklist`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch checklist');
      }

      const data = await response.json();
      setChecklistItems(data.items);
      setStats(data.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId, stage]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleItemCompletion = async (itemId: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/cases/${caseId}/checklist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklistId: itemId,
          isCompleted,
          notes: completionNotes || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update checklist item');
      }

      const result = await response.json();

      // Update local state
      setChecklistItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? {
                ...item,
                completion: result.completion
              }
            : item
        )
      );

      setStats(result.progress);
      setCompletionNotes('');
      setCompletionDialog(false);
      setSelectedItem(null);

      // Show success message
      toast.success(`Item ${isCompleted ? 'completado' : 'actualizado'} exitosamente`);

      // Check if all required items are completed
      if (result.progress.canProgress && onProgressComplete) {
        onProgressComplete();
      }

    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error updating checklist item:', error);
      }
      toast.error('Error al actualizar el item del checklist');
    }
  };

  const openCompletionDialog = (item: ChecklistItem) => {
    setSelectedItem(item);
    setCompletionNotes(item.completion?.notes || '');
    setCompletionDialog(true);
  };

  const getItemIcon = (itemType: string, isCompleted: boolean) => {
    const iconClass = isCompleted ? 'text-green-500' : 'text-gray-400';

    switch (itemType) {
      case 'DOCUMENT':
        return <FileText className={cn('h-5 w-5', iconClass)} />;
      case 'ACTION':
        return <CheckSquare className={cn('h-5 w-5', iconClass)} />;
      case 'VERIFICATION':
        return <Eye className={cn('h-5 w-5', iconClass)} />;
      case 'APPROVAL':
        return <CheckCircle2 className={cn('h-5 w-5', iconClass)} />;
      default:
        return <Circle className={cn('h-5 w-5', iconClass)} />;
    }
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

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Checklist de la Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Checklist de la Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            Error: {error || 'No se pudo cargar el checklist'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Checklist de la Etapa</CardTitle>
              <CardDescription>
                Items requeridos para completar esta etapa
              </CardDescription>
            </div>
            <Badge variant={stats.canProgress ? 'default' : 'secondary'}>
              {stats.percentage.toFixed(0)}% Completado
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {/* Progress Overview */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progreso del Checklist</span>
              <span>{stats.completed} de {stats.total} items</span>
            </div>
            <Progress value={stats.percentage} className="h-2" />

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{stats.completed}</div>
                <div className="text-xs text-gray-600">Completados</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">{stats.pending}</div>
                <div className="text-xs text-gray-600">Pendientes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {stats.canProgress ? '✓' : '○'}
                </div>
                <div className="text-xs text-gray-600">
                  {stats.canProgress ? 'Puede avanzar' : 'Incompleto'}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border transition-all",
                    item.completion?.isCompleted
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200',
                    !item.isRequired && 'opacity-75'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getItemIcon(item.itemType, !!item.completion?.isCompleted)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            'font-medium',
                            item.completion?.isCompleted && 'text-green-700'
                          )}>
                            {item.title}
                          </h3>
                          {item.isRequired && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Este item es requerido</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}

                        {item.completion?.isCompleted && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completado por {item.completion.completedBy?.name}</span>
                            </div>

                            {item.completion.completedAt && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(item.completion.completedAt)}</span>
                              </div>
                            )}

                            {item.completion.notes && (
                              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                <strong>Notas:</strong> {item.completion.notes}
                              </div>
                            )}

                            {item.completion.attachmentPath && (
                              <div className="flex items-center gap-2 text-xs text-blue-600">
                                <File className="h-3 w-3" />
                                <button className="hover:underline">
                                  Ver archivo adjunto
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {item.completion?.isCompleted ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCompletionDialog(item)}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ver detalles</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCompletionDialog(item)}
                              >
                                <Circle className="h-4 w-4 text-gray-400" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Completar item</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {stats.pending > 0 && (
                  <span>
                    {stats.pending} item{stats.pending > 1 ? 's' : ''} pendiente{stats.pending > 1 ? 's' : ''}
                  </span>
                )}
                {stats.canProgress && (
                  <span className="text-green-600 font-medium">
                    ✓ Todos los items requeridos están completados
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                onClick={fetchChecklist}
                disabled={loading}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Dialog */}
      <Dialog open={completionDialog} onOpenChange={setCompletionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.completion?.isCompleted ? 'Detalles del Item' : 'Completar Item'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Agrega notas o comentarios sobre este item..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={3}
              />
            </div>

            {selectedItem?.itemType === 'DOCUMENT' && !selectedItem?.completion?.isCompleted && (
              <div>
                <Label htmlFor="attachment">Archivo Adjunto (Opcional)</Label>
                <Input
                  id="attachment"
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {selectedItem?.completion?.isCompleted && (
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium text-sm mb-2">Información de Completación</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>
                    <strong>Completado por:</strong> {selectedItem.completion.completedBy?.name}
                  </div>
                  {selectedItem.completion.completedAt && (
                    <div>
                      <strong>Fecha:</strong> {formatDate(selectedItem.completion.completedAt)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompletionDialog(false)}
            >
              Cancelar
            </Button>

            {!selectedItem?.completion?.isCompleted && (
              <Button
                onClick={() => {
                  if (selectedItem) {
                    handleItemCompletion(selectedItem.id, true);
                  }
                }}
              >
                Marcar como Completado
              </Button>
            )}

            {selectedItem?.completion?.isCompleted && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedItem) {
                    handleItemCompletion(selectedItem.id, false);
                  }
                }}
              >
                Marcar como Incompleto
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}