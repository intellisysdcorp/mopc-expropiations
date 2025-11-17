'use client';

import { useState, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  Building2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import clientLogger from '@/lib/client-logger';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'deadline' | 'meeting' | 'milestone' | 'reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue';
  description?: string;
  caseId?: string;
  caseNumber?: string;
  assignedTo?: string;
  department?: string;
}

interface CaseCalendarProps {
  className?: string;
}

export function CaseCalendar({ className }: CaseCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    types: ['deadline', 'meeting', 'milestone', 'reminder'],
    priorities: ['low', 'medium', 'high', 'urgent'],
    departments: [] as string[],
    showCompleted: true,
  });

  // Load events for the current month
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const response = await fetch(
        `/api/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}&filters=${encodeURIComponent(JSON.stringify(filters))}`
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events.map((event: any) => ({
          ...event,
          date: new Date(event.date),
        })));
      }
    } catch (error) {
      clientLogger.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, filters]);

  useState(() => {
    loadEvents();
  }, [loadEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev =>
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'overdue': return <AlertTriangle className="h-3 w-3 text-red-600" />;
      default: return <Clock className="h-3 w-3 text-blue-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deadline': return <Clock className="h-4 w-4" />;
      case 'meeting': return <Users className="h-4 w-4" />;
      case 'milestone': return <CheckCircle className="h-4 w-4" />;
      case 'reminder': return <AlertTriangle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendario de Casos
              </CardTitle>
              <CardDescription>
                Fechas importantes, plazos y eventos del sistema
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadEvents}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[150px] text-center">
                  <h3 className="font-medium">
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {days.map(day => {
                const dayEvents = getEventsForDate(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toString()}
                    className={cn(
                      "min-h-[100px] border-b border-r p-1 cursor-pointer transition-colors",
                      !isCurrentMonth && "bg-muted/50",
                      isSelected && "bg-blue-50 border-blue-500",
                      isToday && "bg-blue-100",
                      "hover:bg-gray-50"
                    )}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        !isCurrentMonth && "text-muted-foreground",
                        isToday && "text-blue-600"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <Badge variant="secondary" className="text-xs h-5 px-1">
                          {dayEvents.length}
                        </Badge>
                      )}
                    </div>
                    <ScrollArea className="h-[60px]">
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event, index) => (
                          <div
                            key={index}
                            className="text-xs p-1 rounded truncate bg-white border"
                            style={{ borderLeftColor: getPriorityColor(event.priority).replace('bg-', ''), borderLeftWidth: '3px' }}
                          >
                            <div className="flex items-center gap-1">
                              {getTypeIcon(event.type)}
                              <span className="truncate">{event.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground pl-1">
                            +{dayEvents.length - 3} más
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipos de Evento</label>
                <div className="space-y-2">
                  {['deadline', 'meeting', 'milestone', 'reminder'].map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={filters.types.includes(type)}
                        onCheckedChange={(checked) => {
                          setFilters(prev => ({
                            ...prev,
                            types: checked
                              ? [...prev.types, type]
                              : prev.types.filter(t => t !== type)
                          }));
                        }}
                      />
                      <label htmlFor={`type-${type}`} className="text-sm capitalize">
                        {type === 'deadline' ? 'Plazos' :
                         type === 'meeting' ? 'Reuniones' :
                         type === 'milestone' ? 'Hitos' : 'Recordatorios'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Prioridad</label>
                <div className="space-y-2">
                  {['urgent', 'high', 'medium', 'low'].map(priority => (
                    <div key={priority} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${priority}`}
                        checked={filters.priorities.includes(priority)}
                        onCheckedChange={(checked) => {
                          setFilters(prev => ({
                            ...prev,
                            priorities: checked
                              ? [...prev.priorities, priority]
                              : prev.priorities.filter(p => p !== priority)
                          }));
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", getPriorityColor(priority))}></div>
                        <label htmlFor={`priority-${priority}`} className="text-sm">
                          {priority === 'urgent' ? 'Urgente' :
                           priority === 'high' ? 'Alta' :
                           priority === 'medium' ? 'Media' : 'Baja'}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-completed"
                  checked={filters.showCompleted}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ ...prev, showCompleted: checked as boolean }));
                  }}
                />
                <label htmlFor="show-completed" className="text-sm">
                  Mostrar completados
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Events */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(selectedDate, 'd MMMM yyyy', { locale: es })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map(event => (
                      <div key={event.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(event.type)}
                            <h4 className="font-medium text-sm">{event.title}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(event.status)}
                            <div className={cn("w-2 h-2 rounded-full", getPriorityColor(event.priority))}></div>
                          </div>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {event.description}
                          </p>
                        )}
                        {event.caseNumber && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span>Caso: {event.caseNumber}</span>
                          </div>
                        )}
                        {event.assignedTo && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>Asignado a: {event.assignedTo}</span>
                          </div>
                        )}
                        {event.department && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span>{event.department}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay eventos para esta fecha
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Tipos de Evento</div>
                <div className="space-y-1">
                  {[
                    { type: 'deadline', label: 'Plazos', icon: <Clock className="h-4 w-4" /> },
                    { type: 'meeting', label: 'Reuniones', icon: <Users className="h-4 w-4" /> },
                    { type: 'milestone', label: 'Hitos', icon: <CheckCircle className="h-4 w-4" /> },
                    { type: 'reminder', label: 'Recordatorios', icon: <AlertTriangle className="h-4 w-4" /> },
                  ].map(item => (
                    <div key={item.type} className="flex items-center gap-2 text-sm">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Prioridad</div>
                <div className="space-y-1">
                  {['urgent', 'high', 'medium', 'low'].map(priority => (
                    <div key={priority} className="flex items-center gap-2 text-sm">
                      <div className={cn("w-3 h-3 rounded-full", getPriorityColor(priority))}></div>
                      <span>
                        {priority === 'urgent' ? 'Urgente' :
                         priority === 'high' ? 'Alta' :
                         priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Estado</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>Pendiente</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Completado</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span>Vencido</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}