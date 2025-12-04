'use client';

import { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  FileDown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  dataType: 'cases' | 'users' | 'departments' | 'reports' | 'all';
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    status?: string[];
    priority?: string[];
    department?: string[];
    includeArchived: boolean;
  };
  fields: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ExportJob {
  id: string;
  type: ExportOptions['format'];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileName?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface FieldOption {
  id: string;
  label: string;
  default: boolean;
}

export function DataExport() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'excel',
    dataType: 'cases',
    dateRange: {
      start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    },
    filters: {
      status: [],
      priority: [],
      department: [],
      includeArchived: false,
    },
    fields: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const { toast } = useToast();

  const dataTypeFields: Record<string, FieldOption[]> = {
    cases: [
      { id: 'caseNumber', label: 'Número de Caso', default: true },
      { id: 'title', label: 'Título', default: true },
      { id: 'status', label: 'Estado', default: true },
      { id: 'priority', label: 'Prioridad', default: true },
      { id: 'currentStage', label: 'Etapa Actual', default: true },
      { id: 'propertyAddress', label: 'Dirección', default: true },
      { id: 'ownerName', label: 'Propietario', default: true },
      { id: 'estimatedValue', label: 'Valor Estimado', default: false },
      { id: 'assignedTo', label: 'Asignado a', default: true },
      { id: 'createdAt', label: 'Fecha de Creación', default: true },
      { id: 'updatedAt', label: 'Última Actualización', default: false },
      { id: 'department', label: 'Departamento', default: true },
    ],
    users: [
      { id: 'name', label: 'Nombre', default: true },
      { id: 'email', label: 'Email', default: true },
      { id: 'role', label: 'Rol', default: true },
      { id: 'department', label: 'Departamento', default: true },
      { id: 'position', label: 'Posición', default: false },
      { id: 'isActive', label: 'Activo', default: true },
      { id: 'lastLogin', label: 'Último Login', default: false },
      { id: 'createdAt', label: 'Fecha de Creación', default: true },
    ],
    departments: [
      { id: 'name', label: 'Nombre', default: true },
      { id: 'code', label: 'Código', default: true },
      { id: 'description', label: 'Descripción', default: false },
      { id: 'parent', label: 'Departamento Padre', default: false },
      { id: 'isActive', label: 'Activo', default: true },
      { id: 'userCount', label: 'Número de Usuarios', default: true },
      { id: 'caseCount', label: 'Número de Casos', default: true },
    ],
    reports: [
      { id: 'title', label: 'Título', default: true },
      { id: 'type', label: 'Tipo', default: true },
      { id: 'status', label: 'Estado', default: true },
      { id: 'generatedBy', label: 'Generado por', default: true },
      { id: 'generatedAt', label: 'Fecha de Generación', default: true },
      { id: 'parameters', label: 'Parámetros', default: false },
    ],
    all: [],
  };

  const formatIcons = {
    pdf: <FileText className="h-4 w-4 text-red-600" />,
    excel: <FileSpreadsheet className="h-4 w-4 text-green-600" />,
    csv: <FileJson className="h-4 w-4 text-blue-600" />,
    json: <FileJson className="h-4 w-4 text-purple-600" />,
  };

  const statusIcons = {
    pending: <AlertCircle className="h-4 w-4 text-yellow-600" />,
    processing: <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />,
    completed: <CheckCircle className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
  };

  const handleExport = async () => {
    setIsExporting(true);
    const jobId = `export-${Date.now()}`;

    // Add job to the list
    const newJob: ExportJob = {
      id: jobId,
      type: exportOptions.format,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    setExportJobs(prev => [newJob, ...prev]);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();

      // Update job with success
      setExportJobs(prev =>
        prev.map(job =>
          job.id === jobId
            ? {
                ...job,
                status: 'completed',
                progress: 100,
                fileName: data.fileName,
                downloadUrl: data.downloadUrl,
                completedAt: new Date(),
              }
            : job
        )
      );

      toast({
        title: "Exportación completada",
        description: `Los datos han sido exportados exitosamente en formato ${exportOptions.format.toUpperCase()}.`,
      });

      // Trigger download
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      // Update job with error
      setExportJobs(prev =>
        prev.map(job =>
          job.id === jobId
            ? {
                ...job,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : job
        )
      );

      toast({
        title: "Error en exportación",
        description: "No se pudo completar la exportación. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    setExportOptions(prev => ({
      ...prev,
      fields: checked
        ? [...prev.fields, fieldId]
        : prev.fields.filter(id => id !== fieldId),
    }));
  };

  const currentFields = dataTypeFields[exportOptions.dataType] || [];

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Datos
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Datos</DialogTitle>
          <DialogDescription>
            Exporta datos de la plataforma en diferentes formatos (PDF, Excel, CSV, JSON)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formato de Exportación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['pdf', 'excel', 'csv', 'json'] as const).map((format) => (
                  <Button
                    key={format}
                    variant={exportOptions.format === format ? 'default' : 'outline'}
                    className="flex items-center gap-2 h-20 flex-col"
                    onClick={() => setExportOptions(prev => ({ ...prev, format }))}
                  >
                    {formatIcons[format]}
                    <span className="text-sm font-medium">
                      {format.toUpperCase()}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="data" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="data">Datos</TabsTrigger>
              <TabsTrigger value="filters">Filtros</TabsTrigger>
              <TabsTrigger value="fields">Campos</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tipo de Datos</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={exportOptions.dataType}
                    onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, dataType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cases">Casos</SelectItem>
                      <SelectItem value="users">Usuarios</SelectItem>
                      <SelectItem value="departments">Departamentos</SelectItem>
                      <SelectItem value="reports">Reportes</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rango de Fechas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date">Fecha de Inicio</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={exportOptions.dateRange.start}
                        onChange={(e) =>
                          setExportOptions(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, start: e.target.value }
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">Fecha de Fin</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={exportOptions.dateRange.end}
                        onChange={(e) =>
                          setExportOptions(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, end: e.target.value }
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ordenamiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      value={exportOptions.sortBy}
                      onValueChange={(value) => setExportOptions(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">Fecha de Creación</SelectItem>
                        <SelectItem value="updatedAt">Última Actualización</SelectItem>
                        <SelectItem value="title">Título</SelectItem>
                        <SelectItem value="status">Estado</SelectItem>
                        <SelectItem value="priority">Prioridad</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={exportOptions.sortOrder}
                      onValueChange={(value: 'asc' | 'desc') => setExportOptions(prev => ({ ...prev, sortOrder: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascendente</SelectItem>
                        <SelectItem value="desc">Descendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="filters" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filtros de Exportación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Estados</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'ARCHIVED', 'SUSPENDED', 'CANCELLED'].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={exportOptions.filters.status?.includes(status) || false}
                            onCheckedChange={(checked) => {
                              const currentStatuses = exportOptions.filters.status || [];
                              setExportOptions(prev => ({
                                ...prev,
                                filters: {
                                  ...prev.filters,
                                  status: checked
                                    ? [...currentStatuses, status]
                                    : currentStatuses.filter(s => s !== status),
                                },
                              }));
                            }}
                          />
                          <Label htmlFor={`status-${status}`} className="text-sm">
                            {status.replace('_', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Incluir Archivados</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="include-archived"
                        checked={exportOptions.filters.includeArchived}
                        onCheckedChange={(checked) =>
                          setExportOptions(prev => ({
                            ...prev,
                            filters: {
                              ...prev.filters,
                              includeArchived: checked as boolean,
                            },
                          }))
                        }
                      />
                      <Label htmlFor="include-archived" className="text-sm">
                        Incluir casos archivados en la exportación
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fields" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campos a Exportar</CardTitle>
                  <CardDescription>
                    Selecciona los campos que quieres incluir en la exportación
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {currentFields.map((field: FieldOption) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${field.id}`}
                          checked={exportOptions.fields.includes(field.id) || field.default}
                          onCheckedChange={(checked) =>
                            handleFieldToggle(field.id, checked as boolean)
                          }
                        />
                        <Label htmlFor={`field-${field.id}`} className="text-sm">
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recent Export Jobs */}
          {exportJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exportaciones Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exportJobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {statusIcons[job.status]}
                        <div>
                          <p className="font-medium text-sm">
                            Exportación {job.type.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(job.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {job.status === 'processing' && (
                          <div className="w-24">
                            <Progress value={job.progress} className="h-2" />
                          </div>
                        )}
                        {job.status === 'completed' && job.downloadUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = job.downloadUrl!;
                              link.download = job.fileName!;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                          {job.status === 'pending' && 'Pendiente'}
                          {job.status === 'processing' && 'Procesando'}
                          {job.status === 'completed' && 'Completado'}
                          {job.status === 'failed' && 'Error'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar Datos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}