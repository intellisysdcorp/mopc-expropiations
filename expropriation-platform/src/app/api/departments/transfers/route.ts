import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/departments/transfers - Get department transfers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const userId = searchParams.get('userId') || '';
    const transferType = searchParams.get('transferType') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Check user permissions - Super Admin or Department Admin can view transfers
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageDepartments && !userPermissions?.canManageUsers) {
      // If not admin, only show transfers involving the user's department
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { departmentId: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      if (!departmentId) {
        // Force filter to user's department
        searchParams.set('departmentId', user.departmentId);
      } else if (departmentId !== user.departmentId) {
        return NextResponse.json(
          { error: 'No tiene permisos para ver transferencias de otros departamentos' },
          { status: 403 }
        );
      }
    }

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (userId) {
      where.userId = userId;
    }

    if (transferType) {
      where.transferType = transferType.toUpperCase();
    }

    if (departmentId) {
      where.OR = [
        { sourceDepartmentId: departmentId },
        { destinationDepartmentId: departmentId },
      ];
    }

    // Get total count for pagination
    const total = await prisma.departmentTransfer.count({ where });

    // Get transfers with pagination
    const transfers = await prisma.departmentTransfer.findMany({
      where,
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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response = {
      transfers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching department transfers:', error);
    return NextResponse.json(
      { error: 'Error al obtener transferencias de departamento' },
      { status: 500 }
    );
  }
}