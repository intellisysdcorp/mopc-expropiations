import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build filters
    const departmentFilter = departmentId ? { departmentId } : {};

    const alerts = await Promise.all([
      // Overdue cases
      getOverdueCaseAlerts(departmentFilter, limit),
      // Cases approaching deadline
      getDeadlineAlerts(departmentFilter, limit),
      // High priority unassigned cases
      getUnassignedHighPriorityAlerts(departmentFilter, limit),
      // Cases stuck in a stage for too long
      getStagnantCaseAlerts(departmentFilter, limit),
      // Missing documents alerts
      getMissingDocumentAlerts(departmentFilter, limit),
      // Risk alerts
      getRiskAlerts(departmentFilter, limit)
    ]);

    // Flatten and sort all alerts by severity and date
    const allAlerts = alerts.flat().sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
                         (severityOrder[a.severity as keyof typeof severityOrder] || 0);

      if (severityDiff !== 0) return severityDiff;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Filter by severity if specified
    const filteredAlerts = severity
      ? allAlerts.filter(alert => alert.severity === severity)
      : allAlerts;

    // Limit results
    const limitedAlerts = filteredAlerts.slice(0, limit);

    return NextResponse.json({
      alerts: limitedAlerts,
      summary: {
        total: allAlerts.length,
        critical: allAlerts.filter(a => a.severity === 'critical').length,
        high: allAlerts.filter(a => a.severity === 'high').length,
        medium: allAlerts.filter(a => a.severity === 'medium').length,
        low: allAlerts.filter(a => a.severity === 'low').length
      }
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

async function getOverdueCaseAlerts(departmentFilter: any, limit: number) {
  const overdueCases = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      expectedEndDate: {
        lt: new Date()
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      assignedTo: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    take: limit
  });

  return overdueCases.map(case_ => ({
    id: `overdue-${case_.id}`,
    type: 'overdue',
    severity: 'critical',
    title: `Caso Vencido: ${case_.fileNumber}`,
    message: `El caso "${case_.title}" está ${Math.floor(
      (new Date().getTime() - new Date(case_.expectedEndDate).getTime()) /
      (1000 * 60 * 60 * 24)
    )} días vencido.`,
    caseId: case_.id,
    departmentName: case_.department.name,
    assignedTo: case_.assignedTo ? `${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : null,
    actionUrl: `/cases/${case_.id}`,
    createdAt: case_.expectedEndDate,
    isActionable: true,
    actionText: 'Revisar Caso'
  }));
}

async function getDeadlineAlerts(departmentFilter: any, limit: number) {
  const upcomingDeadlines = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      expectedEndDate: {
        gte: new Date(),
        lte: endOfDay(subDays(new Date(), -3)) // Next 3 days
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      assignedTo: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    take: limit
  });

  return upcomingDeadlines.map(case_ => {
    const daysUntilDue = Math.floor(
      (new Date(case_.expectedEndDate).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return {
      id: `deadline-${case_.id}`,
      type: 'deadline',
      severity: daysUntilDue <= 1 ? 'critical' : daysUntilDue <= 2 ? 'high' : 'medium',
      title: `Fecha Límite Próxima: ${case_.fileNumber}`,
      message: `El caso "${case_.title}" tiene fecha límite en ${daysUntilDue} día(s).`,
      caseId: case_.id,
      departmentName: case_.department.name,
      assignedTo: case_.assignedTo ? `${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : null,
      actionUrl: `/cases/${case_.id}`,
      createdAt: new Date(),
      isActionable: true,
      actionText: 'Priorizar Caso'
    };
  });
}

async function getUnassignedHighPriorityAlerts(departmentFilter: any, limit: number) {
  const unassignedCases = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      priority: {
        in: ['HIGH', 'URGENT']
      },
      assignedToId: null,
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      },
      createdAt: {
        gte: startOfDay(subDays(new Date(), 7)) // Created in last 7 days
      }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      createdBy: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    take: limit
  });

  return unassignedCases.map(case_ => ({
    id: `unassigned-${case_.id}`,
    type: 'unassigned',
    severity: case_.priority === 'URGENT' ? 'critical' : 'high',
    title: `Caso sin Asignar: ${case_.fileNumber}`,
    message: `Caso de prioridad ${case_.priority} "${case_.title}" no tiene analista asignado.`,
    caseId: case_.id,
    departmentName: case_.department.name,
    assignedTo: null,
    actionUrl: `/cases/${case_.id}?action=assign`,
    createdAt: case_.createdAt,
    isActionable: true,
    actionText: 'Asignar Analista'
  }));
}

async function getStagnantCaseAlerts(departmentFilter: any, limit: number) {
  // Find cases that haven't been updated in more than 14 days
  const stagnantCases = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      updatedAt: {
        lt: subDays(new Date(), 14)
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      assignedTo: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    take: limit
  });

  return stagnantCases.map(case_ => {
    const daysInactive = Math.floor(
      (new Date().getTime() - new Date(case_.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return {
      id: `stagnant-${case_.id}`,
      type: 'stagnant',
      severity: daysInactive > 30 ? 'high' : 'medium',
      title: `Caso Inactivo: ${case_.fileNumber}`,
      message: `El caso "${case_.title}" no ha sido actualizado en ${daysInactive} días.`,
      caseId: case_.id,
      departmentName: case_.department.name,
      assignedTo: case_.assignedTo ? `${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : null,
      actionUrl: `/cases/${case_.id}`,
      createdAt: case_.updatedAt,
      isActionable: true,
      actionText: 'Revisar Progreso'
    };
  });
}

async function getMissingDocumentAlerts(departmentFilter: any, limit: number) {
  // Cases with required documents missing (simplified logic)
  const casesWithMissingDocs = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      },
      currentStage: {
        in: ['CARGA_DOCUMENTOS', 'ANALISIS_PRELIMINAR', 'PERITAJE_TECNICO']
      }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      assignedTo: {
        select: { firstName: true, lastName: true, email: true }
      },
      _count: {
        select: {
          documents: true
        }
      }
    },
    take: limit
  });

  return casesWithMissingDocs
    .filter(case_ => case_._count.documents < 3) // Assuming at least 3 documents are required
    .map(case_ => ({
      id: `documents-${case_.id}`,
      type: 'missing-documents',
      severity: 'medium',
      title: `Documentos Faltantes: ${case_.fileNumber}`,
      message: `El caso "${case_.title}" requiere más documentos para continuar.`,
      caseId: case_.id,
      departmentName: case_.department.name,
      assignedTo: case_.assignedTo ? `${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : null,
      actionUrl: `/cases/${case_.id}?tab=documents`,
      createdAt: new Date(),
      isActionable: true,
      actionText: 'Cargar Documentos'
    }));
}

async function getRiskAlerts(departmentFilter: any, limit: number) {
  const riskAlerts = await prisma.riskAlert.findMany({
    where: {
      riskAssessment: {
        case: {
          ...departmentFilter,
          deletedAt: null
        }
      },
      isActive: true,
      resolvedAt: null
    },
    include: {
      riskAssessment: {
        include: {
          case: {
            include: {
              department: {
                select: { name: true, code: true }
              },
              assignedTo: {
                select: { firstName: true, lastName: true, email: true }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return riskAlerts.map(alert => ({
    id: `risk-${alert.id}`,
    type: 'risk',
    severity: alert.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
    title: `Alerta de Riesgo: ${alert.riskAssessment.case.fileNumber}`,
    message: alert.message,
    caseId: alert.riskAssessment.caseId,
    departmentName: alert.riskAssessment.case.department.name,
    assignedTo: alert.riskAssessment.case.assignedTo
      ? `${alert.riskAssessment.case.assignedTo.firstName} ${alert.riskAssessment.case.assignedTo.lastName}`
      : null,
    actionUrl: `/cases/${alert.riskAssessment.caseId}?tab=risk`,
    createdAt: alert.createdAt,
    isActionable: true,
    actionText: 'Gestionar Riesgo'
  }));
}