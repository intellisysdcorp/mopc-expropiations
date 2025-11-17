'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FlowChart,
  GitBranch,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

interface FlowNode {
  id: string;
  stage: string;
  stageLabel: string;
  caseCount: number;
  avgDuration: number;
  bottleneckLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  nextStages: string[];
  color: string;
}

interface FlowData {
  nodes: FlowNode[];
  totalCases: number;
  avgProcessTime: number;
  completionRate: number;
  bottlenecks: string[];
  recommendations: string[];
}

interface CaseFlowVisualizationProps {
  departmentId?: string;
}

const STAGE_LABELS: Record<string, string> = {
  'RECEPCION_SOLICITUD': 'Recepción',
  'VERIFICACION_REQUISITOS': 'Verificación',
  'CARGA_DOCUMENTOS': 'Carga Docs',
  'ASIGNACION_ANALISTA': 'Asignación',
  'ANALISIS_PRELIMINAR': 'Análisis',
  'NOTIFICACION_PROPIETARIO': 'Notificación',
  'PERITAJE_TECNICO': 'Peritaje',
  'DETERMINACION_VALOR': 'Valoración',
  'OFERTA_COMPRA': 'Oferta',
  'NEGOCIACION': 'Negociación',
  'APROBACION_ACUERDO': 'Aprobación',
  'ELABORACION_ESCRITURA': 'Escritura',
  'FIRMA_DOCUMENTOS': 'Firma',
  'REGISTRO_PROPIEDAD': 'Registro',
  'DESEMBOLSO_PAGO': 'Pago',
  'ENTREGA_INMUEBLE': 'Entrega',
  'CIERRE_ARCHIVO': 'Cierre'
};

const STAGE_COLORS: Record<string, string> = {
  'RECEPCION_SOLICITUD': '#3b82f6',
  'VERIFICACION_REQUISITOS': '#6366f1',
  'CARGA_DOCUMENTOS': '#8b5cf6',
  'ASIGNACION_ANALISTA': '#a855f7',
  'ANALISIS_PRELIMINAR': '#d946ef',
  'NOTIFICACION_PROPIETARIO': '#ec4899',
  'PERITAJE_TECNICO': '#f43f5e',
  'DETERMINACION_VALOR': '#ef4444',
  'OFERTA_COMPRA': '#f97316',
  'NEGOCIACION': '#fb923c',
  'APROBACION_ACUERDO': '#fbbf24',
  'ELABORACION_ESCRITURA': '#facc15',
  'FIRMA_DOCUMENTOS': '#84cc16',
  'REGISTRO_PROPIEDAD': '#22c55e',
  'DESEMBOLSO_PAGO': '#10b981',
  'ENTREGA_INMUEBLE': '#14b8a6',
  'CIERRE_ARCHIVO': '#06b6d4'
};

function FlowNodeComponent({ node, onStageClick }: {
  node: FlowNode;
  onStageClick: (stage: string) => void;
}) {
  const getBottleneckColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getBottleneckIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-white" />;
      case 'high': return <Clock className="h-4 w-4 text-white" />;
      case 'medium': return <Clock className="h-4 w-4 text-white" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-white" />;
      default: return null;
    }
  };

  return (
    <div
      className="relative bg-white border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all hover:border-blue-400"
      onClick={() => onStageClick(node.stage)}
      style={{ borderColor: node.color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-900">{node.stageLabel}</h3>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${getBottleneckColor(node.bottleneckLevel)}`}
        >
          {getBottleneckIcon(node.bottleneckLevel)}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Casos activos:</span>
          <Badge variant="secondary" className="text-xs">
            {node.caseCount}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Tiempo promedio:</span>
          <span className="text-xs font-medium">{node.avgDuration} días</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mt-3 line-clamp-2">
        {node.description}
      </p>

      {/* Progress indicator */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(100, (node.caseCount / 10) * 100)}%`,
              backgroundColor: node.color
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}

function FlowConnection() {
  return (
    <div className="flex items-center justify-center my-2">
      <ArrowRight className="h-6 w-6 text-gray-400" />
    </div>
  );
}

export function CaseFlowVisualization({ departmentId }: CaseFlowVisualizationProps) {
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'current' | 'historical' | 'predictive'>('current');
  const [timeRange, setTimeRange] = useState('30');

  const fetchFlowData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        view: selectedView,
        timeRange,
        ...(departmentId && { departmentId })
      });

      const response = await fetch(`/api/dashboard/flow?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch flow data');
      }

      const data = await response.json();
      setFlowData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading flow data');
      clientLogger.error('Error fetching flow data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
  }, [departmentId, selectedView, timeRange]);

  // Mock data for demonstration
  const mockFlowData: FlowData = {
    nodes: [
      {
        id: '1',
        stage: 'RECEPCION_SOLICITUD',
        stageLabel: 'Recepción',
        caseCount: 5,
        avgDuration: 2,
        bottleneckLevel: 'low',
        description: 'Recepción inicial de solicitudes de expropiación',
        nextStages: ['VERIFICACION_REQUISITOS'],
        color: STAGE_COLORS['RECEPCION_SOLICITUD']
      },
      {
        id: '2',
        stage: 'VERIFICACION_REQUISITOS',
        stageLabel: 'Verificación',
        caseCount: 8,
        avgDuration: 5,
        bottleneckLevel: 'medium',
        description: 'Verificación de requisitos y documentación básica',
        nextStages: ['CARGA_DOCUMENTOS'],
        color: STAGE_COLORS['VERIFICACION_REQUISITOS']
      },
      {
        id: '3',
        stage: 'CARGA_DOCUMENTOS',
        stageLabel: 'Carga de Docs',
        caseCount: 12,
        avgDuration: 7,
        bottleneckLevel: 'high',
        description: 'Carga y validación de documentos requeridos',
        nextStages: ['ASIGNACION_ANALISTA'],
        color: STAGE_COLORS['CARGA_DOCUMENTOS']
      },
      {
        id: '4',
        stage: 'ANALISIS_PRELIMINAR',
        stageLabel: 'Análisis',
        caseCount: 6,
        avgDuration: 10,
        bottleneckLevel: 'low',
        description: 'Análisis preliminar del caso',
        nextStages: ['PERITAJE_TECNICO'],
        color: STAGE_COLORS['ANALISIS_PRELIMINAR']
      },
      {
        id: '5',
        stage: 'NEGOCIACION',
        stageLabel: 'Negociación',
        caseCount: 4,
        avgDuration: 15,
        bottleneckLevel: 'critical',
        description: 'Negociación con propietarios',
        nextStages: ['APROBACION_ACUERDO'],
        color: STAGE_COLORS['NEGOCIACION']
      }
    ],
    totalCases: 35,
    avgProcessTime: 45,
    completionRate: 68.5,
    bottlenecks: ['CARGA_DOCUMENTOS', 'NEGOCIACION'],
    recommendations: [
      'Asignar más personal a la carga de documentos',
      'Implementar sistema de seguimiento de negociaciones',
      'Automatizar verificaciones básicas'
    ]
  };

  const dataToDisplay = flowData || mockFlowData;

  const handleStageClick = (stage: string) => {
    clientLogger.info('Clicked stage:', stage);
    // Navigate to detailed stage view
  };

  if (loading && !flowData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FlowChart className="h-5 w-5" />
            Visualización del Flujo de Casos
          </CardTitle>
          <CardDescription>
            Análisis visual del pipeline de casos y cuellos de botella
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
                {i < 4 && <div className="flex justify-center my-2">
                  <ArrowRight className="h-6 w-6 text-gray-300" />
                </div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar flujo de casos</h3>
            <p className="text-sm mb-4">{error}</p>
            <Button onClick={fetchFlowData} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Vista:</span>
          </div>
          <Select value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Estado Actual</SelectItem>
              <SelectItem value="historical">Histórico</SelectItem>
              <SelectItem value="predictive">Predictivo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchFlowData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Flow Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flow */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GitBranch className="h-5 w-5" />
                Flujo Principal de Casos
              </CardTitle>
              <CardDescription>
                Pipeline actual y distribución de casos por etapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataToDisplay.nodes.map((node, index) => (
                  <div key={node.id}>
                    <FlowNodeComponent
                      node={node}
                      onStageClick={handleStageClick}
                    />
                    {index < dataToDisplay.nodes.length - 1 && <FlowConnection />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics and Insights */}
        <div className="space-y-6">
          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Métricas Clave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Casos totales</div>
                  <div className="text-2xl font-bold">{dataToDisplay.totalCases}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Tiempo promedio</div>
                  <div className="text-2xl font-bold">{dataToDisplay.avgProcessTime} días</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Tasa de completación</div>
                  <div className="text-2xl font-bold">{dataToDisplay.completionRate}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottlenecks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Cuellos de Botella
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dataToDisplay.bottlenecks.map((bottleneck, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm">{STAGE_LABELS[bottleneck] || bottleneck}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recomendaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dataToDisplay.recommendations.map((recommendation, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    • {recommendation}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}