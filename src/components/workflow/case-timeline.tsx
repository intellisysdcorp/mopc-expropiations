'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  FileText,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'stage_start' | 'stage_complete' | 'stage_return' | 'document_upload' | 'assignment_change' | 'note_added';
  stage?: string;
  stageName?: string;
  title: string;
  description?: string;
  timestamp: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: any;
  duration?: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface TimelineStage {
  stage: string;
  name: string;
  description: string;
  sequenceOrder: number;
  responsibleDepartment: string;
  estimatedDuration: number;
  status: 'completed' | 'current' | 'future' | 'skipped';
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  checklistProgress: {
    total: number;
    completed: number;
    percentage: number;
  };
  events: TimelineEvent[];
}

interface TimelineResponse {
  case: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: string;
    status: string;
    startDate: Date;
    expectedEndDate?: Date;
    actualEndDate?: Date;
    progressPercentage: number;
  };
  stages: TimelineStage[];
  events: TimelineEvent[];
  statistics: {
    totalDuration: number;
    averageStageDuration: number;
    completedStages: number;
    remainingStages: number;
    overdueStages: number;
  };
}

interface CaseTimelineProps {
  caseId: string;
  className?: string;
}

export function CaseTimeline({ caseId, className }: CaseTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cases/${caseId}/timeline`);

      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setTimeline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const toggleStageExpansion = (stageName: string) => {
    setExpandedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageName)) {
        newSet.delete(stageName);
      } else {
        newSet.add(stageName);
      }
      return newSet;
    });
  };

  const getStageIcon = (stage: TimelineStage) => {
    if (stage.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (stage.status === 'current') {
      return <Clock className="h-5 w-5 text-blue-500" />;
    } else if (stage.status === 'skipped') {
      return <RotateCcw className="h-5 w-5 text-orange-500" />;
    } else {
      return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case 'stage_start':
        return <Circle className="h-4 w-4 text-blue-500" />;
      case 'stage_complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'stage_return':
        return <RotateCcw className="h-4 w-4 text-orange-500" />;
      case 'document_upload':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'assignment_change':
        return <User className="h-4 w-4 text-indigo-500" />;
      case 'note_added':
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
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

  const formatDuration = (days: number) => {
    if (days === 0) return 'Mismo día';
    if (days === 1) return '1 día';
    return `${days} días`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Línea de Tiempo del Caso</CardTitle>
          <CardDescription>Cargando información...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !timeline) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Línea de Tiempo del Caso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            Error: {error || 'No se pudo cargar la línea de tiempo'}
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
              <CardTitle>Línea de Tiempo del Caso</CardTitle>
              <CardDescription>
                Caso {timeline.case.fileNumber} - {timeline.case.title}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={timeline.case.status === 'COMPLETADO' ? 'default' : 'secondary'}>
                {timeline.case.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchTimeline}>
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Statistics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {timeline.statistics.completedStages}
              </div>
              <div className="text-sm text-gray-600">Etapas Completadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {timeline.statistics.remainingStages}
              </div>
              <div className="text-sm text-gray-600">Etapas Restantes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {formatDuration(timeline.statistics.totalDuration)}
              </div>
              <div className="text-sm text-gray-600">Duración Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {timeline.statistics.overdueStages}
              </div>
              <div className="text-sm text-gray-600">Etapas Retrasadas</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progreso General</span>
              <span>{timeline.case.progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${timeline.case.progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Timeline Stages */}
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {timeline.stages.map((stage, index) => (
                <div key={stage.stage} className="relative">
                  {/* Stage Header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer",
                      stage.status === 'current' && 'bg-blue-50 border-blue-200',
                      stage.status === 'completed' && 'bg-green-50 border-green-200',
                      selectedStage === stage.name && 'ring-2 ring-blue-500'
                    )}
                    onClick={() => setSelectedStage(stage.name === selectedStage ? null : stage.name)}
                  >
                    <div className="flex-shrink-0">
                      {getStageIcon(stage)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{stage.name}</h3>
                          <p className="text-sm text-gray-600">{stage.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {stage.responsibleDepartment}
                            </Badge>
                            {stage.duration && (
                              <span className="text-xs text-gray-500">
                                Duración: {formatDuration(stage.duration)}
                              </span>
                            )}
                            {stage.estimatedDuration > 0 && (
                              <span className="text-xs text-gray-500">
                                Estimado: {formatDuration(stage.estimatedDuration)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {stage.checklistProgress.total > 0 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    {stage.checklistProgress.percentage.toFixed(0)}%
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {stage.checklistProgress.completed}/{stage.checklistProgress.total}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Progreso del checklist</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {stage.events.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStageExpansion(stage.name);
                              }}
                            >
                              {expandedStages.has(stage.name) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stage Events (Expanded) */}
                  {expandedStages.has(stage.name) && stage.events.length > 0 && (
                    <div className="ml-8 mt-2 space-y-2">
                      {stage.events.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 mt-1">
                            {getEventIcon(event)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <span className="text-xs text-gray-500">
                                {formatDate(event.timestamp)}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{event.user.name}</span>
                              {event.duration && (
                                <>
                                  <Clock className="h-3 w-3 text-gray-400 ml-2" />
                                  <span className="text-xs text-gray-500">
                                    {formatDuration(event.duration)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connection Line */}
                  {index < timeline.stages.length - 1 && (
                    <div className="absolute left-6 top-16 bottom-0 w-px bg-gray-300" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Recent Events Summary */}
          {timeline.events.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3">Eventos Recientes</h3>
              <div className="space-y-2">
                {timeline.events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 text-sm">
                    {getEventIcon(event)}
                    <div className="flex-1">
                      <span className="font-medium">{event.title}</span>
                      <span className="text-gray-500 ml-2">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}