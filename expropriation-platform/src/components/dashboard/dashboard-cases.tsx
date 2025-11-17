'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Clock,
  FileText,
  AlertTriangle,
  User,
  Calendar,
  MoreHorizontal,
  Eye,
  Edit,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import clientLogger from '@/lib/client-logger';

interface CaseItem {
  id: string;
  fileNumber: string;
  title: string;
  ownerName: string;
  propertyAddress: string;
  status: string;
  currentStage: string;
  priority: string;
  progressPercentage: number;
  createdAt: string;
  expectedEndDate: string | null;
  isDraft?: boolean;
  department: {
    id: string;
    name: string;
    code: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  documentCount?: number;
  activityCount?: number;
  pendingReason?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  overdueDays?: number;
  daysInCurrentStage?: number;
}

interface CasesResponse {
  cases: CaseItem[];
  type: string;
}

interface DashboardCasesProps {
  departmentId?: string;
  userId?: string;
}

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
};

const STATUS_COLORS = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  EN_PROGRESO: 'bg-blue-100 text-blue-800',
  COMPLETADO: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
};

const URGENCY_COLORS = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600'
};

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente'
  };
  return labels[priority] || priority;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROGRESO: 'En Progreso',
    COMPLETADO: 'Completado',
    ARCHIVED: 'Archivado',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Cancelado'
  };
  return labels[status] || status.replace('_', ' ');
}

function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    RECEPCION_SOLICITUD: 'Recepción',
    VERIFICACION_REQUISITOS: 'Verificación',
    CARGA_DOCUMENTOS: 'Carga Docs',
    ASIGNACION_ANALISTA: 'Asignación',
    ANALISIS_PRELIMINAR: 'Análisis',
    NOTIFICACION_PROPIETARIO: 'Notificación',
    PERITAJE_TECNICO: 'Peritaje',
    DETERMINACION_VALOR: 'Valoración',
    OFERTA_COMPRA: 'Oferta',
    NEGOCIACION: 'Negociación',
    APROBACION_ACUERDO: 'Aprobación',
    ELABORACION_ESCRITURA: 'Escritura',
    FIRMA_DOCUMENTOS: 'Firma',
    REGISTRO_PROPIEDAD: 'Registro',
    DESEMBOLSO_PAGO: 'Pago',
    ENTREGA_INMUEBLE: 'Entrega',
    CIERRE_ARCHIVO: 'Cierre'
  };
  return labels[stage] || stage.replace(/_/g, ' ');
}

function CaseTableRow({ caseItem, type }: { caseItem: CaseItem; type: string }) {
  const getUrgencyIcon = () => {
    switch (caseItem.urgency) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <TableRow className={`hover:bg-gray-50 ${caseItem.isDraft ? 'bg-gray-50/30' : ''}`}>
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className={URGENCY_COLORS[caseItem.urgency || 'low']}>
            {getUrgencyIcon()}
          </div>
          <div className="flex items-center gap-2">
            {caseItem.isDraft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center">
                      <FileText className="h-4 w-4 text-gray-400 cursor-help" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Este caso es un borrador</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div>
              <div className={`font-medium ${caseItem.isDraft ? 'text-gray-500 italic' : ''}`}>
                {caseItem.fileNumber}
              </div>
              <div className={`text-sm max-w-xs truncate ${caseItem.isDraft ? 'text-gray-400' : 'text-gray-500'}`}>
                {caseItem.title}
              </div>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{caseItem.ownerName}</div>
          <div className="text-sm text-gray-500 truncate max-w-xs">
            {caseItem.propertyAddress}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge className={STATUS_COLORS[caseItem.status as keyof typeof STATUS_COLORS]}>
            {getStatusLabel(caseItem.status)}
          </Badge>
          <div className="text-xs text-gray-500">
            {getStageLabel(caseItem.currentStage)}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge className={PRIORITY_COLORS[caseItem.priority as keyof typeof PRIORITY_COLORS]}>
            {getPriorityLabel(caseItem.priority)}
          </Badge>
          <div className="text-xs text-gray-500">
            {caseItem.progressPercentage}% completo
          </div>
        </div>
      </TableCell>
      <TableCell>
        {caseItem.assignedTo ? (
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {caseItem.assignedTo.firstName[0]}{caseItem.assignedTo.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium">
                {caseItem.assignedTo.firstName} {caseItem.assignedTo.lastName}
              </div>
              <div className="text-gray-500 truncate max-w-xs">
                {caseItem.assignedTo.email}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-gray-500 text-sm">Sin asignar</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="text-sm text-gray-600">
            Creado: {formatDistanceToNow(new Date(caseItem.createdAt), {
              addSuffix: true,
              locale: es
            })}
          </div>
          {caseItem.expectedEndDate && (
            <div className="text-sm text-gray-600">
              Límite: {format(new Date(caseItem.expectedEndDate), 'dd/MM/yyyy')}
            </div>
          )}
          {type === 'overdue' && caseItem.overdueDays && (
            <div className="text-sm text-red-600 font-medium">
              {caseItem.overdueDays} días vencido
            </div>
          )}
          {type === 'assigned' && caseItem.daysInCurrentStage && (
            <div className="text-sm text-blue-600">
              {caseItem.daysInCurrentStage} días en etapa
            </div>
          )}
          {type === 'pending' && caseItem.pendingReason && (
            <div className="text-sm text-orange-600">
              {caseItem.pendingReason}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          {caseItem.documentCount !== undefined && (
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {caseItem.documentCount}
            </Badge>
          )}
          {caseItem.activityCount !== undefined && (
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {caseItem.activityCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => window.open(`/cases/${caseItem.id}`, '_blank')}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`/cases/${caseItem.id}?action=edit`, '_blank')}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.open(`/cases/${caseItem.id}?action=assign`, '_blank')}
            >
              <User className="mr-2 h-4 w-4" />
              Asignar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(`/cases/${caseItem.id}?action=comment`, '_blank')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Comentar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.open(`/cases/${caseItem.id}`, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir en nueva pestaña
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function CasesSection({
  title,
  description,
  type,
  icon,
  departmentId,
  userId
}: {
  title: string;
  description: string;
  type: string;
  icon: React.ReactNode;
  departmentId?: string;
  userId?: string;
}) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type, limit: '5' });
      if (departmentId) params.append('departmentId', departmentId);
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/dashboard/cases?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const data: CasesResponse = await response.json();
      setCases(data.cases);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading cases');
      clientLogger.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [departmentId, userId, type]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.push(`/cases?filter=${type}`)}
          >
            Ver todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && cases.length === 0 ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <Button onClick={fetchCases} variant="outline" size="sm">
              Reintentar
            </Button>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay casos para mostrar</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caso</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseItem) => (
                  <CaseTableRow key={caseItem.id} caseItem={caseItem} type={type} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCases({ departmentId, userId }: DashboardCasesProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CasesSection
          title="Casos Recientes"
          description="Últimos casos creados en el sistema"
          type="recent"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          departmentId={departmentId}
          userId={userId}
        />
        <CasesSection
          title="Casos Pendientes"
          description="Casos que requieren atención inmediata"
          type="pending"
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          departmentId={departmentId}
          userId={userId}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CasesSection
          title="Casos Vencidos"
          description="Casos que han superado su fecha límite"
          type="overdue"
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          departmentId={departmentId}
          userId={userId}
        />
        <CasesSection
          title="Alta Prioridad"
          description="Casos urgentes y de alta prioridad"
          type="high-priority"
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          departmentId={departmentId}
          userId={userId}
        />
      </div>
    </div>
  );
}