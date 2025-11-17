import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for transfer approval/rejection
const transferActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

// POST /api/departments/transfers/[id]/action - Approve or reject transfer
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
        { error: 'No tiene permisos para aprobar transferencias' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes } = transferActionSchema.parse(body);

    // Find transfer
    const transfer = await prisma.departmentTransfer.findUnique({
      where: { id: (await params).id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            departmentId: true,
          },
        },
        sourceDepartment: {
          select: { id: true, name: true, code: true },
        },
        destinationDepartment: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transferencia no encontrada' },
        { status: 404 }
      );
    }

    if (transfer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta transferencia ya ha sido procesada' },
        { status: 400 }
      );
    }

    let updatedTransfer;
    let activityDescription;
    const metadata: any = {
      transferId: transfer.id,
      userName: `${transfer.user.firstName} ${transfer.user.lastName}`,
      sourceDepartment: transfer.sourceDepartment.name,
      destinationDepartment: transfer.destinationDepartment.name,
      transferType: transfer.transferType,
      notes,
    };

    if (action === 'approve') {
      // Update user's department
      await prisma.user.update({
        where: { id: transfer.userId },
        data: {
          departmentId: transfer.destinationDepartmentId,
        },
      });

      // Update transfer
      updatedTransfer = await prisma.departmentTransfer.update({
        where: { id: (await params).id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          approvedBy: session.user.id,
          approvedAt: new Date(),
          notes: notes || transfer.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          sourceDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          destinationDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      activityDescription = `Transferencia aprobada: ${transfer.user.firstName} ${transfer.user.lastName}`;
      metadata.approvedBy = session.user.id;
      metadata.approvedAt = new Date().toISOString();
    } else {
      // Reject transfer
      updatedTransfer = await prisma.departmentTransfer.update({
        where: { id: (await params).id },
        data: {
          status: 'CANCELLED',
          notes: notes || transfer.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          sourceDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          destinationDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      activityDescription = `Transferencia rechazada: ${transfer.user.firstName} ${transfer.user.lastName}`;
      metadata.rejectedBy = session.user.id;
      metadata.rejectedAt = new Date().toISOString();
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: action === 'approve' ? 'APPROVED' : 'REJECTED',
      entityType: 'department_transfer',
      entityId: transfer.id,
      description: activityDescription,
      metadata,
    });

    return NextResponse.json({
      message: `Transferencia ${action === 'approve' ? 'aprobada' : 'rechazada'} correctamente`,
      transfer: updatedTransfer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error processing department transfer action:', error);
    return NextResponse.json(
      { error: 'Error al procesar acción de transferencia' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/transfers/[id] - Update transfer
export async function PUT(
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
        { error: 'No tiene permisos para actualizar transferencias' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { scheduledFor, notes, transferType, reason } = body;

    // Find transfer
    const transfer = await prisma.departmentTransfer.findUnique({
      where: { id: (await params).id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sourceDepartment: {
          select: { id: true, name: true, code: true },
        },
        destinationDepartment: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transferencia no encontrada' },
        { status: 404 }
      );
    }

    if (transfer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Solo se pueden actualizar transferencias pendientes' },
        { status: 400 }
      );
    }

    // Update transfer
    const updatedTransfer = await prisma.departmentTransfer.update({
      where: { id: (await params).id },
      data: {
        ...(scheduledFor && { scheduledFor: new Date(scheduledFor) }),
        ...(notes && { notes }),
        ...(transferType && { transferType }),
        ...(reason && { reason }),
        metadata: {
          ...transfer.metadata,
          lastUpdatedBy: session.user.id,
          lastUpdatedAt: new Date().toISOString(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sourceDepartment: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        destinationDepartment: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department_transfer',
      entityId: transfer.id,
      description: `Transferencia actualizada: ${transfer.user.firstName} ${transfer.user.lastName}`,
      metadata: {
        transferId: transfer.id,
        userName: `${transfer.user.firstName} ${transfer.user.lastName}`,
        sourceDepartment: transfer.sourceDepartment.name,
        destinationDepartment: transfer.destinationDepartment.name,
        updatedFields: Object.keys(body),
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json({
      message: 'Transferencia actualizada correctamente',
      transfer: updatedTransfer,
    });
  } catch (error) {
    logger.error('Error updating department transfer:', error);
    return NextResponse.json(
      { error: 'Error al actualizar transferencia' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/transfers/[id] - Cancel transfer
export async function DELETE(
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
        { error: 'No tiene permisos para cancelar transferencias' },
        { status: 403 }
      );
    }

    // Find transfer
    const transfer = await prisma.departmentTransfer.findUnique({
      where: { id: (await params).id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        sourceDepartment: {
          select: { id: true, name: true, code: true },
        },
        destinationDepartment: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transferencia no encontrada' },
        { status: 404 }
      );
    }

    if (transfer.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'No se puede cancelar una transferencia completada' },
        { status: 400 }
      );
    }

    // Cancel transfer
    await prisma.departmentTransfer.update({
      where: { id: (await params).id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...transfer.metadata,
          cancelledBy: session.user.id,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CANCELLED',
      entityType: 'department_transfer',
      entityId: transfer.id,
      description: `Transferencia cancelada: ${transfer.user.firstName} ${transfer.user.lastName}`,
      metadata: {
        transferId: transfer.id,
        userName: `${transfer.user.firstName} ${transfer.user.lastName}`,
        sourceDepartment: transfer.sourceDepartment.name,
        destinationDepartment: transfer.destinationDepartment.name,
        cancelledBy: session.user.id,
      },
    });

    return NextResponse.json({
      message: 'Transferencia cancelada correctamente',
    });
  } catch (error) {
    logger.error('Error cancelling department transfer:', error);
    return NextResponse.json(
      { error: 'Error al cancelar transferencia' },
      { status: 500 }
    );
  }
}