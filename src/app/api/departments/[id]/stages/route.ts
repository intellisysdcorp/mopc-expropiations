import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { CaseStage } from '@/prisma/client';
import { logger } from '@/lib/logger';

// Schema for stage assignment
const stageAssignmentSchema = z.object({
  stages: z.array(z.nativeEnum(CaseStage)).min(1, 'Selecciona al menos una etapa'),
});

// GET /api/departments/[id]/stages - Get department stage assignments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: (await params).id },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Get current stage assignments
    const assignments = await prisma.departmentStageAssignment.findMany({
      where: {
        departmentId: (await params).id,
        isActive: true,
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Get all available stages
    const allStages = Object.values(CaseStage);

    // Get case statistics per stage for this department
    const stageStats = await Promise.all(
      allStages.map(async (stage) => {
        const count = await prisma.case.count({
          where: {
            departmentId: (await params).id,
            currentStage: stage,
          },
        });

        return {
          stage,
          count,
          isAssigned: assignments.some(a => a.stage === stage),
        };
      })
    );

    return NextResponse.json({
      department,
      assignments: assignments.map(a => ({
        id: a.id,
        stage: a.stage,
        assignedAt: a.assignedAt,
        assignedBy: a.assignedBy,
      })),
      stageStatistics: stageStats,
      availableStages: allStages,
    });
  } catch (error) {
    logger.error('Error fetching department stage assignments:', error);
    return NextResponse.json(
      { error: 'Error al obtener asignaciones de etapas del departamento' },
      { status: 500 }
    );
  }
}

// POST /api/departments/[id]/stages - Assign stages to department
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage departments
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageDepartments && !userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para asignar etapas a departamentos' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { stages } = stageAssignmentSchema.parse(body);

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Deactivate existing assignments
    await prisma.departmentStageAssignment.updateMany({
      where: {
        departmentId: id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create new assignments
    const newAssignments = await Promise.all(
      stages.map(stage =>
        prisma.departmentStageAssignment.create({
          data: {
            departmentId: id,
            stage,
            assignedBy: session.user.id,
          },
        })
      )
    );

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: id,
      description: `Etapas asignadas al departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        assignedStages: stages,
        previousAssignments: await prisma.departmentStageAssignment.findMany({
          where: {
            departmentId: (await params).id,
            isActive: false,
          },
          select: { stage: true, assignedAt: true },
        }),
      },
    });

    return NextResponse.json({
      message: `${stages.length} etapa(s) asignada(s) correctamente`,
      assignments: newAssignments.map(a => ({
        id: a.id,
        stage: a.stage,
        assignedAt: a.assignedAt,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error assigning stages to department:', error);
    return NextResponse.json(
      { error: 'Error al asignar etapas al departamento' },
      { status: 500 }
    );
  }
}

