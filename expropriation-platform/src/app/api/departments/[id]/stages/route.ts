import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { CaseStage } from '@prisma/client';
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

// PUT /api/departments/[id]/stages/[stage] - Update specific stage assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const departmentId = (await params).id;
    const stage = (await params).stage as CaseStage;

    // Validate stage
    if (!Object.values(CaseStage).includes(stage)) {
      return NextResponse.json(
        { error: 'Etapa inválida' },
        { status: 400 }
      );
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.departmentStageAssignment.findUnique({
      where: {
        departmentId_stage: {
          departmentId,
          stage,
        },
      },
    });

    if (!existingAssignment) {
      // Create new assignment
      const assignment = await prisma.departmentStageAssignment.create({
        data: {
          departmentId,
          stage,
          assignedBy: session.user.id,
        },
      });

      // Log activity
      await logActivity({
        userId: session.user.id,
        action: 'UPDATED',
        entityType: 'department',
        entityId: departmentId,
        description: `Etapa asignada al departamento: ${department.name}`,
        metadata: {
          departmentName: department.name,
          departmentCode: department.code,
          stage,
        },
      });

      return NextResponse.json({
        message: `Etapa ${stage} asignada correctamente`,
        assignment: {
          id: assignment.id,
          stage: assignment.stage,
          isActive: assignment.isActive,
          assignedAt: assignment.assignedAt,
        },
      });
    } else {
      // Toggle existing assignment
      const assignment = await prisma.departmentStageAssignment.update({
        where: {
          departmentId_stage: {
            departmentId,
            stage,
          },
        },
        data: {
          isActive: !existingAssignment.isActive,
        },
      });

      // Log activity
      await logActivity({
        userId: session.user.id,
        action: 'UPDATED',
        entityType: 'department',
        entityId: departmentId,
        description: `Etapa ${assignment.isActive ? 'activada' : 'desactivada'} para el departamento: ${department.name}`,
        metadata: {
          departmentName: department.name,
          departmentCode: department.code,
          stage,
          previousState: existingAssignment.isActive,
          newState: assignment.isActive,
        },
      });

      return NextResponse.json({
        message: `Etapa ${stage} ${assignment.isActive ? 'activada' : 'desactivada'} correctamente`,
        assignment: {
          id: assignment.id,
          stage: assignment.stage,
          isActive: assignment.isActive,
          assignedAt: assignment.assignedAt,
        },
      });
    }
  } catch (error) {
    logger.error('Error updating stage assignment:', error);
    return NextResponse.json(
      { error: 'Error al actualizar asignación de etapa' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id]/stages/[stage] - Remove stage assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const departmentId = (await params).id;
    const stage = (await params).stage as CaseStage;

    // Validate stage
    if (!Object.values(CaseStage).includes(stage)) {
      return NextResponse.json(
        { error: 'Etapa inválida' },
        { status: 400 }
      );
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Check if there are active cases in this stage
    const activeCases = await prisma.case.count({
      where: {
        departmentId,
        currentStage: stage,
        status: 'EN_PROGRESO',
      },
    });

    if (activeCases > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar la asignación de la etapa ${stage} mientras haya ${activeCases} caso(s) activo(s) en esta etapa` },
        { status: 400 }
      );
    }

    // Deactivate assignment instead of deleting
    const assignment = await prisma.departmentStageAssignment.updateMany({
      where: {
        departmentId,
        stage,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (assignment.count === 0) {
      return NextResponse.json(
        { error: 'Asignación de etapa no encontrada' },
        { status: 404 }
      );
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: departmentId,
      description: `Etapa eliminada del departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        stage,
      },
    });

    return NextResponse.json({
      message: `Etapa ${stage} eliminada correctamente`,
    });
  } catch (error) {
    logger.error('Error removing stage assignment:', error);
    return NextResponse.json(
      { error: 'Error al eliminar asignación de etapa' },
      { status: 500 }
    );
  }
}