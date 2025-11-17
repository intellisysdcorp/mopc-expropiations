'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Calendar,
  Filter,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clientLogger from '@/lib/client-logger';

interface ExportOptions {
  format: 'pdf' | 'excel';
  dateRange: {
    from: Date;
    to: Date;
  };
  includeCharts: boolean;
  includeStatistics: boolean;
  includeCases: boolean;
  includeAlerts: boolean;
  departmentId?: string;
  status?: string[];
  priority?: string[];
}

interface ExportResult {
  success: boolean;
  message: string;
  downloadUrl?: string;
  error?: string;
}

interface ExportToolsProps {
  departmentId?: string;
  availableData?: {
    totalCases: number;
    dateRange: { from: Date; to: Date };
  };
}

export function ExportTools({ departmentId, availableData }: ExportToolsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      to: new Date()
    },
    includeCharts: true,
    includeStatistics: true,
    includeCases: true,
    includeAlerts: true,
    departmentId
  });

  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `export-${exportOptions.format}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.${exportOptions.format}`;

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportResult({
        success: true,
        message: `Reporte exportado exitosamente como ${filename}`,
        downloadUrl: url
      });
    } catch (error) {
      setExportResult({
        success: false,
        message: 'Error al exportar el reporte',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/template?type=${type}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Template download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `template-${type}.`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename + type;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      clientLogger.error('Template download error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Export Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-red-600" />
              <div>
                <h3 className="font-semibold text-sm">Exportar PDF</h3>
                <p className="text-xs text-gray-500">Reporte completo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-sm">Exportar Excel</h3>
                <p className="text-xs text-gray-500">Datos detallados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-sm">Plantilla PDF</h3>
                <p className="text-xs text-gray-500">Descargar formato</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-purple-600" />
              <div>
                <h3 className="font-semibold text-sm">Plantilla Excel</h3>
                <p className="text-xs text-gray-500">Descargar formato</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Export Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                Exportación Personalizada
              </CardTitle>
              <CardDescription>
                Configure y genere reportes personalizados según sus necesidades
              </CardDescription>
            </div>
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Exportación
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configurar Exportación</DialogTitle>
                  <DialogDescription>
                    Personalice el contenido y formato del reporte a exportar
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Format */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="format">Formato de Exportación</Label>
                      <Select
                        value={exportOptions.format}
                        onValueChange={(value: 'pdf' | 'excel') =>
                          setExportOptions(prev => ({ ...prev, format: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <span>PDF - Reporte Visual</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="excel">
                            <div className="flex items-center space-x-2">
                              <FileSpreadsheet className="h-4 w-4" />
                              <span>Excel - Datos Tabulares</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range */}
                    <div>
                      <Label>Rango de Fechas</Label>
                      <div className="text-sm text-gray-500 mt-1">
                        {format(exportOptions.dateRange.from, 'dd MMM yyyy', { locale: es })} -{' '}
                        {format(exportOptions.dateRange.to, 'dd MMM yyyy', { locale: es })}
                      </div>
                    </div>

                    {/* Department Filter */}
                    {departmentId && (
                      <div>
                        <Label>Departamento</Label>
                        <div className="text-sm text-gray-500 mt-1">
                          Solo casos del departamento actual
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Selection */}
                  <div className="space-y-4">
                    <Label>Contenido a Incluir</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="statistics"
                          checked={exportOptions.includeStatistics}
                          onCheckedChange={(checked) =>
                            setExportOptions(prev => ({
                              ...prev,
                              includeStatistics: checked as boolean
                            }))
                          }
                        />
                        <Label htmlFor="statistics">Estadísticas generales</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="charts"
                          checked={exportOptions.includeCharts}
                          onCheckedChange={(checked) =>
                            setExportOptions(prev => ({
                              ...prev,
                              includeCharts: checked as boolean
                            }))
                          }
                        />
                        <Label htmlFor="charts">Gráficos y visualizaciones</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cases"
                          checked={exportOptions.includeCases}
                          onCheckedChange={(checked) =>
                            setExportOptions(prev => ({
                              ...prev,
                              includeCases: checked as boolean
                            }))
                          }
                        />
                        <Label htmlFor="cases">Lista de casos</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="alerts"
                          checked={exportOptions.includeAlerts}
                          onCheckedChange={(checked) =>
                            setExportOptions(prev => ({
                              ...prev,
                              includeAlerts: checked as boolean
                            }))
                          }
                        />
                        <Label htmlFor="alerts">Alertas críticas</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Result */}
                {exportResult && (
                  <div className={`p-4 rounded-md ${
                    exportResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {exportResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`text-sm ${
                        exportResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {exportResult.message}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Exportando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Export Summary */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Resumen de Datos</h4>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Casos totales: {availableData?.totalCases || 'N/A'}</div>
                <div>Período: {availableData ?
                  `${format(availableData.dateRange.from, 'dd/MM/yyyy')} - ${format(availableData.dateRange.to, 'dd/MM/yyyy')}` :
                  'N/A'
                }</div>
              </div>
            </div>

            {/* Export Templates */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Plantillas</h4>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('pdf')}
                  disabled={isExporting}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('excel')}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  Excel
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Acciones Rápidas</h4>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportOptions(prev => ({ ...prev, format: 'pdf' }));
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  PDF Rápido
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportOptions(prev => ({ ...prev, format: 'excel' }));
                    handleExport();
                  }}
                  disabled={isExporting}
                >
                  Excel Rápido
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}