import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { CaseStatus, Priority } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'recent';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build filters
    const departmentFilter = departmentId ? { departmentId } : {};
    const userFilter = userId ? { assignedToId: userId } : {};

    const baseWhere = {
      ...departmentFilter,
      ...userFilter,
      deletedAt: null
    };

    switch (type) {
      case 'recent':
        return await getRecentCases(baseWhere, limit);
      case 'pending':
        return await getPendingCases(baseWhere, limit);
      case 'overdue':
        return await getOverdueCases(baseWhere, limit);
      case 'assigned':
        return await getAssignedCases(baseWhere, limit);
      case 'high-priority':
        return await getHighPriorityCases(baseWhere, limit);
      default:
        return await getRecentCases(baseWhere, limit);
    }
  } catch (error) {
    logger.error('Error fetching cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

async function getRecentCases(whereClause: any, limit: number) {
  const cases = await prisma.case.findMany({
    where: whereClause,
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      _count: {
        select: {
          documents: true,
          activities: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  const formattedCases = cases.map(case_ => ({
    id: case_.id,
    fileNumber: case_.fileNumber,
    title: case_.title,
    ownerName: case_.ownerName,
    propertyAddress: case_.propertyAddress,
    status: case_.status,
    currentStage: case_.currentStage,
    priority: case_.priority,
    progressPercentage: case_.progressPercentage,
    createdAt: case_.createdAt,
    expectedEndDate: case_.expectedEndDate,
    department: case_.department,
    createdBy: case_.createdBy,
    assignedTo: case_.assignedTo,
    documentCount: case_._count.documents,
    activityCount: case_._count.activities,
    urgency: calculateUrgency(case_.priority, case_.expectedEndDate, case_.status)
  }));

  return NextResponse.json({ cases: formattedCases, type: 'recent' });
}

async function getPendingCases(whereClause: any, limit: number) {
  const cases = await prisma.case.findMany({
    where: {
      ...whereClause,
      status: 'PENDIENTE'
    },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      _count: {
        select: {
          documents: true
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ],
    take: limit
  });

  const formattedCases = cases.map(case_ => ({
    id: case_.id,
    fileNumber: case_.fileNumber,
    title: case_.title,
    ownerName: case_.ownerName,
    propertyAddress: case_.propertyAddress,
    status: case_.status,
    currentStage: case_.currentStage,
    priority: case_.priority,
    progressPercentage: case_.progressPercentage,
    createdAt: case_.createdAt,
    expectedEndDate: case_.expectedEndDate,
    department: case_.department,
    createdBy: case_.createdBy,
    assignedTo: case_.assignedTo,
    documentCount: case_._count.documents,
    pendingReason: getPendingReason(case_.currentStage),
    urgency: calculateUrgency(case_.priority, case_.expectedEndDate, case_.status)
  }));

  return NextResponse.json({ cases: formattedCases, type: 'pending' });
}

async function getOverdueCases(whereClause: any, limit: number) {
  const cases = await prisma.case.findMany({
    where: {
      ...whereClause,
      expectedEndDate: {
        lt: new Date()
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      }
    },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      _count: {
        select: {
          documents: true,
          activities: true
        }
      }
    },
    orderBy: { expectedEndDate: 'asc' },
    take: limit
  });

  const formattedCases = cases.map(case_ => ({
    id: case_.id,
    fileNumber: case_.fileNumber,
    title: case_.title,
    ownerName: case_.ownerName,
    propertyAddress: case_.propertyAddress,
    status: case_.status,
    currentStage: case_.currentStage,
    priority: case_.priority,
    progressPercentage: case_.progressPercentage,
    createdAt: case_.createdAt,
    expectedEndDate: case_.expectedEndDate,
    department: case_.department,
    createdBy: case_.createdBy,
    assignedTo: case_.assignedTo,
    documentCount: case_._count.documents,
    activityCount: case_._count.activities,
    overdueDays: Math.floor(
      (new Date().getTime() - new Date(case_.expectedEndDate).getTime()) /
      (1000 * 60 * 60 * 24)
    ),
    urgency: 'critical' as const
  }));

  return NextResponse.json({ cases: formattedCases, type: 'overdue' });
}

async function getAssignedCases(whereClause: any, limit: number) {
  const cases = await prisma.case.findMany({
    where: {
      ...whereClause,
      assignedToId: { not: null },
      status: {
        in: ['PENDIENTE', 'EN_PROGRESO']
      }
    },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      _count: {
        select: {
          documents: true,
          activities: true
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { updatedAt: 'desc' }
    ],
    take: limit
  });

  const formattedCases = cases.map(case_ => ({
    id: case_.id,
    fileNumber: case_.fileNumber,
    title: case_.title,
    ownerName: case_.ownerName,
    propertyAddress: case_.propertyAddress,
    status: case_.status,
    currentStage: case_.currentStage,
    priority: case_.priority,
    progressPercentage: case_.progressPercentage,
    createdAt: case_.createdAt,
    updatedAt: case_.updatedAt,
    expectedEndDate: case_.expectedEndDate,
    department: case_.department,
    createdBy: case_.createdBy,
    assignedTo: case_.assignedTo,
    documentCount: case_._count.documents,
    activityCount: case_._count.activities,
    daysInCurrentStage: calculateDaysInCurrentStage(case_.id, case_.updatedAt),
    urgency: calculateUrgency(case_.priority, case_.expectedEndDate, case_.status)
  }));

  return NextResponse.json({ cases: formattedCases, type: 'assigned' });
}

async function getHighPriorityCases(whereClause: any, limit: number) {
  const cases = await prisma.case.findMany({
    where: {
      ...whereClause,
      priority: {
        in: ['HIGH', 'URGENT']
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      }
    },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      _count: {
        select: {
          documents: true,
          activities: true
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ],
    take: limit
  });

  const formattedCases = cases.map(case_ => ({
    id: case_.id,
    fileNumber: case_.fileNumber,
    title: case_.title,
    ownerName: case_.ownerName,
    propertyAddress: case_.propertyAddress,
    status: case_.status,
    currentStage: case_.currentStage,
    priority: case_.priority,
    progressPercentage: case_.progressPercentage,
    createdAt: case_.createdAt,
    expectedEndDate: case_.expectedEndDate,
    department: case_.department,
    createdBy: case_.createdBy,
    assignedTo: case_.assignedTo,
    documentCount: case_._count.documents,
    activityCount: case_._count.activities,
    urgency: calculateUrgency(case_.priority, case_.expectedEndDate, case_.status)
  }));

  return NextResponse.json({ cases: formattedCases, type: 'high-priority' });
}

function calculateUrgency(priority: Priority, expectedEndDate: Date | null, status: CaseStatus): 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'COMPLETADO') return 'low';
  if (status === 'CANCELLED') return 'low';

  const now = new Date();
  if (!expectedEndDate) {
    return priority === 'URGENT' ? 'high' : priority === 'HIGH' ? 'medium' : 'low';
  }

  const daysUntilDue = Math.floor(
    (expectedEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) return 'critical';
  if (daysUntilDue < 3) return 'high';
  if (daysUntilDue < 7) return 'medium';
  if (priority === 'URGENT') return 'high';
  if (priority === 'HIGH') return 'medium';

  return 'low';
}

function getPendingReason(stage: string): string {
  const reasons: Record<string, string> = {
    'RECEPCION_SOLICITUD': 'Esperando revisión inicial',
    'VERIFICACION_REQUISITOS': 'Verificando documentación',
    'CARGA_DOCUMENTOS': 'Esperando carga de documentos',
    'ASIGNACION_ANALISTA': 'Esperando asignación de analista',
    'ANALISIS_PRELIMINAR': 'En análisis preliminar',
    'NOTIFICACION_PROPIETARIO': 'Esperando notificación al propietario',
    'PERITAJE_TECNICO': 'Esperando peritaje técnico',
    'DETERMINACION_VALOR': 'En proceso de valoración',
    'OFERTA_COMPRA': 'Preparando oferta de compra',
    'NEGOCIACION': 'En negociación',
    'APROBACION_ACUERDO': 'Esperando aprobación del acuerdo',
    'ELABORACION_ESCRITURA': 'Elaborando escritura',
    'FIRMA_DOCUMENTOS': 'Esperando firma de documentos',
    'REGISTRO_PROPIEDAD': 'En proceso de registro',
    'DESEMBOLSO_PAGO': 'Procesando pago',
    'ENTREGA_INMUEBLE': 'Coordinando entrega'
  };

  return reasons[stage] || 'En proceso';
}

function calculateDaysInCurrentStage(caseId: string, updatedAt: Date): number {
  // This would ideally be calculated based on stage progression history
  // For now, return days since last update
  return Math.floor(
    (new Date().getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
}