'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  ExternalLink,
  Bell,
  BellRing,
  Filter,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clientLogger from '@/lib/client-logger';

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  caseId?: string;
  departmentName?: string;
  assignedTo?: string;
  actionUrl?: string;
  createdAt: string | Date;
  isActionable: boolean;
  actionText?: string;
}

interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface AlertsResponse {
  alerts: Alert[];
  summary: AlertSummary;
}

interface DashboardAlertsProps {
  departmentId?: string;
  userId?: string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-100 text-red-800'
  },
  high: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    badgeColor: 'bg-orange-100 text-orange-800'
  },
  medium: {
    icon: Info,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  low: {
    icon: Bell,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
};

function AlertCard({ alert }: { alert: Alert }) {
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = config.icon;

  return (
    <Card className={`transition-all hover:shadow-md ${config.bgColor} ${config.borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className={`mt-1 ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {alert.title}
              </h4>
              <Badge className={config.badgeColor} variant="secondary">
                {alert.severity === 'critical' && 'Crítica'}
                {alert.severity === 'high' && 'Alta'}
                {alert.severity === 'medium' && 'Media'}
                {alert.severity === 'low' && 'Baja'}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-3">{alert.message}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {alert.departmentName && (
                  <span>Dept: {alert.departmentName}</span>
                )}
                {alert.assignedTo && (
                  <span>Asignado a: {alert.assignedTo}</span>
                )}
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(alert.createdAt), {
                      addSuffix: true,
                      locale: es
                    })}
                  </span>
                </div>
              </div>

              {alert.isActionable && alert.actionUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(alert.actionUrl, '_blank')}
                  className="flex items-center space-x-1"
                >
                  <span>{alert.actionText || 'Ver'}</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertSummaryCard({ summary, onRefresh, loading }: {
  summary: AlertSummary;
  onRefresh: () => void;
  loading: boolean;
}) {
  const totalSeverity = summary.critical + summary.high + summary.medium + summary.low;
  const criticalPercentage = totalSeverity > 0 ? (summary.critical / totalSeverity) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-gray-600" />
            <CardTitle>Resumen de Alertas</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Estado actual de alertas del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
            <div className="text-sm text-gray-500">Críticas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
            <div className="text-sm text-gray-500">Altas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
            <div className="text-sm text-gray-500">Medias</div>
          </div>
        </div>

        {criticalPercentage > 20 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">
                {criticalPercentage.toFixed(1)}% de las alertas son críticas
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardAlerts({ departmentId, userId }: DashboardAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (departmentId) params.append('departmentId', departmentId);
      if (userId) params.append('userId', userId);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (selectedType !== 'all') params.append('type', selectedType);

      const response = await fetch(`/api/dashboard/alerts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data: AlertsResponse = await response.json();
      setAlerts(data.alerts);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading alerts');
      clientLogger.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [departmentId, userId, selectedSeverity, selectedType]);

  // Auto-refresh every 2 minutes for critical alerts
  useEffect(() => {
    const interval = setInterval(() => {
      if (summary && summary.critical > 0) {
        fetchAlerts();
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [summary]);

  const getFilteredAlerts = () => {
    let filtered = alerts;

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === selectedSeverity);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(alert => alert.type === selectedType);
    }

    return filtered;
  };

  const getAlertTypes = () => {
    const types = [...new Set(alerts.map(alert => alert.type))];
    return types.sort();
  };

  const filteredAlerts = getFilteredAlerts();
  const alertTypes = getAlertTypes();

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {summary && (
        <AlertSummaryCard
          summary={summary}
          onRefresh={fetchAlerts}
          loading={loading}
        />
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">Filtros:</span>
        </div>

        <div className="flex space-x-2">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Todas las severidades</option>
            <option value="critical">Críticas</option>
            <option value="high">Altas</option>
            <option value="medium">Medias</option>
            <option value="low">Bajas</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Todos los tipos</option>
            {alertTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-500">
          Mostrando {filteredAlerts.length} de {alerts.length} alertas
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-red-600">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar alertas</h3>
              <p className="text-sm mb-4">{error}</p>
              <Button onClick={fetchAlerts} variant="outline">
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && alerts.length === 0 && !error && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="h-5 w-5 bg-gray-200 rounded mt-1"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alerts List */}
      {!loading && !error && filteredAlerts.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay alertas para mostrar
              </h3>
              <p className="text-gray-500">
                {selectedSeverity !== 'all' || selectedType !== 'all'
                  ? 'Intenta cambiar los filtros para ver más alertas'
                  : 'Todo está funcionando correctamente'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredAlerts.length > 0 && (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}