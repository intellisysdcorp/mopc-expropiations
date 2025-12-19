import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { CaseStage } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// PUT /api/departments/[id]/stages/[stage] - Update specific stage assignment
export async function PUT(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const departmentId = (await params).id;
    if (!departmentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }
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
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const departmentId = (await params).id;
    if (!departmentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }
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
      action: 'DELETED',
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
