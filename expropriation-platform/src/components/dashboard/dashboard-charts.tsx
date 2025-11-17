'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import clientLogger from '@/lib/client-logger';

interface ChartData {
  timeline: Array<{
    date: string;
    created: number;
    completed: number;
    inProgress: number;
    total: number;
  }>;
  priority: Array<{
    name: string;
    value: number;
    fill: string;
  }>;
  status: Array<{
    name: string;
    value: number;
    fill: string;
  }>;
  departments?: Array<{
    name: string;
    cases: number;
    efficiency: number;
    completion: number;
  }>;
  stages?: Array<{
    stage: string;
    current: number;
    progression: number;
    avgTime: number;
  }>;
  efficiency?: Array<{
    name: string;
    value: number;
    fill: string;
  }>;
  monthlyTrend?: Array<{
    month: string;
    completed: number;
    avgDuration: number;
  }>;
}

interface DashboardChartsProps {
  departmentId?: string;
}

const COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  INFO: '#6366f1',
  SECONDARY: '#6b7280',
  URGENT: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#84cc16'
};

export function DashboardCharts({ departmentId }: DashboardChartsProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [chartType, setChartType] = useState<'overview' | 'department' | 'stage' | 'performance'>('overview');

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: chartType,
        period: selectedPeriod
      });
      if (departmentId) params.append('departmentId', departmentId);

      const response = await fetch(`/api/dashboard/charts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const data = await response.json();
      setChartData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading charts');
      clientLogger.error('Error fetching chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [departmentId, selectedPeriod, chartType]);

  if (loading && !chartData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p className="mb-4">{error}</p>
            <Button onClick={fetchChartData} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'dd/MM');
  };

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            {(['overview', 'department', 'stage', 'performance'] as const).map((type) => (
              <Button
                key={type}
                variant={chartType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType(type)}
              >
                {type === 'overview' && 'General'}
                {type === 'department' && 'Departamentos'}
                {type === 'stage' && 'Etapas'}
                {type === 'performance' && 'Rendimiento'}
              </Button>
            ))}
          </div>
          <div className="flex space-x-2">
            {['7', '30', '90'].map((period) => (
              <Badge
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedPeriod(period)}
              >
                {period === '7' && '7d'}
                {period === '30' && '30d'}
                {period === '90' && '90d'}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolución de Casos
            </CardTitle>
            <CardDescription>
              Casos creados y completados en el período seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value, name) => [
                    value,
                    name === 'created' ? 'Creados' :
                    name === 'completed' ? 'Completados' :
                    name === 'inProgress' ? 'En Progreso' : name
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stackId="1"
                  stroke={COLORS.INFO}
                  fill={COLORS.INFO}
                  fillOpacity={0.6}
                  name="created"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stackId="1"
                  stroke={COLORS.SUCCESS}
                  fill={COLORS.SUCCESS}
                  fillOpacity={0.6}
                  name="completed"
                />
                <Area
                  type="monotone"
                  dataKey="inProgress"
                  stackId="1"
                  stroke={COLORS.WARNING}
                  fill={COLORS.WARNING}
                  fillOpacity={0.6}
                  name="inProgress"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Prioridad</CardTitle>
            <CardDescription>
              Casos por nivel de prioridad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.priority}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.priority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Estado Actual de Casos</CardTitle>
            <CardDescription>
              Distribución por estado actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.status}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickFormatter={(value) => value.replace('_', ' ')}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [value, 'Casos']}
                  labelFormatter={(value) => value.replace('_', ' ')}
                />
                <Bar dataKey="value" name="casos">
                  {chartData.status.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dynamic Chart based on type */}
        {chartType === 'department' && chartData.departments && (
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Departamento</CardTitle>
              <CardDescription>
                Eficiencia y tasa de completación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.departments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cases" fill={COLORS.PRIMARY} name="Casos" />
                  <Bar dataKey="efficiency" fill={COLORS.SUCCESS} name="Eficiencia %" />
                  <Bar dataKey="completion" fill={COLORS.WARNING} name="Completación %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {chartType === 'stage' && chartData.stages && (
          <Card>
            <CardHeader>
              <CardTitle>Análisis por Etapa</CardTitle>
              <CardDescription>
                Casos actuales y tiempo promedio por etapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.stages} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" fill={COLORS.PRIMARY} name="Casos Actuales" />
                  <Bar dataKey="avgTime" fill={COLORS.WARNING} name="Tiempo Prom (días)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {chartType === 'performance' && chartData.efficiency && (
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Eficiencia</CardTitle>
              <CardDescription>
                Clasificación de rendimiento de casos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.efficiency}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.efficiency.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}