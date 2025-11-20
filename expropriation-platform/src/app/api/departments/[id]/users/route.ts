import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/departments/[id]/users - Get users in a department
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const roleId = searchParams.get('roleId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'firstName';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const { id } = await params;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      departmentId: id,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (roleId) {
      where.roleId = roleId;
    }

    // Get total count for pagination
    const total = await prisma.user.count({ where });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        phone: true,
        isActive: true,
        isSuspended: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { id: true, name: true, description: true },
        },
        _count: {
          select: {
            createdCases: true,
            assignedCases: true,
            supervisedCases: true,
            activities: true,
            documents: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response = {
      users: users.map(user => ({
        ...user,
        totalCases: user._count.createdCases + user._count.assignedCases + user._count.supervisedCases,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      department,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching department users:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuarios del departamento' },
      { status: 500 }
    );
  }
}

// Schema for user transfer
const transferUserSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Selecciona al menos un usuario'),
  destinationDepartmentId: z.string().min(1, 'El departamento de destino es requerido'),
  transferType: z.enum(['PROMOTION', 'DEMOTION', 'LATERAL', 'TEMPORARY']),
  reason: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// POST /api/departments/[id]/users - Transfer users to another department
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
        { error: 'No tiene permisos para transferir usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = transferUserSchema.parse(body);

    const { id: sourceDepartmentId } = await params;
    const { destinationDepartmentId, userIds, transferType, reason, scheduledFor, notes } = validatedData;

    // Validate source department
    const sourceDept = await prisma.department.findUnique({
      where: { id: sourceDepartmentId },
    });

    if (!sourceDept) {
      return NextResponse.json(
        { error: 'Departamento de origen no encontrado' },
        { status: 404 }
      );
    }

    // Validate destination department
    const destDept = await prisma.department.findUnique({
      where: { id: destinationDepartmentId },
    });

    if (!destDept) {
      return NextResponse.json(
        { error: 'Departamento de destino no encontrado' },
        { status: 404 }
      );
    }

    // Prevent transfers within the same department
    if (sourceDepartmentId === destinationDepartmentId) {
      return NextResponse.json(
        { error: 'No se puede transferir usuarios al mismo departamento' },
        { status: 400 }
      );
    }

    // Validate users exist and belong to source department
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        departmentId: sourceDepartmentId,
        deletedAt: null,
      },
    });

    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: 'Algunos usuarios no se encontraron o no pertenecen al departamento de origen' },
        { status: 400 }
      );
    }

    // Create transfer records
    const transfers = await Promise.all(
      userIds.map(userId =>
        prisma.departmentTransfer.create({
          data: {
            userId,
            sourceDepartmentId,
            destinationDepartmentId,
            transferType,
            reason,
            effectiveDate: scheduledFor ? new Date(scheduledFor) : new Date(),
            scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            status: scheduledFor ? 'PENDING' : 'IN_PROGRESS',
            notes,
            metadata: {
              initiatedBy: session.user.id,
              initiatedAt: new Date().toISOString(),
            },
          },
        })
      )
    );

    // If transfer is immediate (not scheduled), update users
    if (!scheduledFor) {
      await prisma.user.updateMany({
        where: {
          id: { in: userIds },
        },
        data: {
          departmentId: destinationDepartmentId,
        },
      });

      // Update transfer status to completed
      await prisma.departmentTransfer.updateMany({
        where: {
          id: { in: transfers.map(t => t.id) },
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      });

      // Log activity for each user
      await Promise.all(
        users.map(user =>
          logActivity({
            userId: session.user.id,
            action: 'TRANSFERRED',
            entityType: 'user',
            entityId: user.id,
            description: `Usuario transferido: ${user.firstName} ${user.lastName}`,
            metadata: {
              userName: `${user.firstName} ${user.lastName}`,
              sourceDepartment: sourceDept.name,
              destinationDepartment: destDept.name,
              transferType,
              reason,
            },
          })
        )
      );
    } else {
      // Log scheduled transfer activity
      await logActivity({
        userId: session.user.id,
        action: 'SCHEDULED_TRANSFER',
        entityType: 'user',
        entityId: userIds.join(','),
        description: `Transferencia programada para ${userIds.length} usuario(s)`,
        metadata: {
          userIds,
          sourceDepartment: sourceDept.name,
          destinationDepartment: destDept.name,
          transferType,
          reason,
          scheduledFor,
        },
      });
    }

    return NextResponse.json({
      message: scheduledFor
        ? `Transferencia programada para ${userIds.length} usuario(s)`
        : `${userIds.length} usuario(s) transferido(s) correctamente`,
      transfers: transfers.map(t => ({
        id: t.id,
        userId: t.userId,
        status: t.status,
        effectiveDate: t.effectiveDate,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error transferring users:', error);
    return NextResponse.json(
      { error: 'Error al transferir usuarios' },
      { status: 500 }
    );
  }
}