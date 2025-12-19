import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// Schema for permission assignment
const permissionAssignmentSchema = z.object({
  permissionIds: z.array(z.string()).min(1, 'Selecciona al menos un permiso'),
  isGranted: z.boolean().default(true),
  expiresAt: z.iso.datetime().optional(),
});

// GET /api/departments/[id]/permissions - Get department permissions
export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, parentId: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Get all available permissions
    const allPermissions = await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Get department-specific permissions
    const departmentPermissions = await prisma.departmentPermission.findMany({
      where: {
        departmentId: id,
      },
      include: {
        permission: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Get inherited permissions from parent departments
    const inheritedPermissions = await getInheritedPermissions(id);

    // Get permissions through user roles
    const roleBasedPermissions = await getRoleBasedPermissions(id);

    return NextResponse.json({
      department,
      allPermissions,
      departmentPermissions: departmentPermissions.map(dp => ({
        id: dp.id,
        permission: dp.permission,
        isGranted: dp.isGranted,
        assignedAt: dp.assignedAt,
        assignedBy: dp.assignedBy,
        expiresAt: dp.expiresAt,
      })),
      inheritedPermissions,
      roleBasedPermissions,
    });
  } catch (error) {
    logger.error('Error fetching department permissions:', error);
    return NextResponse.json(
      { error: 'Error al obtener permisos del departamento' },
      { status: 500 }
    );
  }
}

// POST /api/departments/[id]/permissions - Assign permissions to department
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Bad Request: missing key param'},
      { status: 400 }
    )
  }
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage departments
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageDepartments && !userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para asignar permisos a departamentos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permissionIds, isGranted, expiresAt } = permissionAssignmentSchema.parse(body);

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

    // Validate permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
        isActive: true,
      },
    });

    if (permissions.length !== permissionIds.length) {
      return NextResponse.json(
        { error: 'Algunos permisos no existen o no están activos' },
        { status: 400 }
      );
    }

    // Create or update permission assignments
    const assignments = await Promise.all(
      permissionIds.map(async (permissionId) => {
        // Check if assignment already exists
        const existing = await prisma.departmentPermission.findUnique({
          where: {
            departmentId_permissionId: {
              departmentId: id,
              permissionId,
            },
          },
        });

        if (existing) {
          // Update existing assignment
          return await prisma.departmentPermission.update({
            where: {
              departmentId_permissionId: {
                departmentId: id,
                permissionId,
              },
            },
            data: {
              isGranted,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
              assignedBy: session.user.id,
            },
          });
        } else {
          // Create new assignment
          return await prisma.departmentPermission.create({
            data: {
              departmentId: id,
              permissionId,
              isGranted,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
              assignedBy: session.user.id,
            },
          });
        }
      })
    );

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: id,
      description: `Permisos ${isGranted ? 'otorgados' : 'revocados'} al departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        permissionIds,
        permissions: permissions.map(p => ({ id: p.id, name: p.name, type: p.type })),
        isGranted,
        expiresAt,
      },
    });

    return NextResponse.json({
      message: `${permissionIds.length} permiso(s) ${isGranted ? 'otorgado(s)' : 'revocado(s)'} correctamente`,
      assignments: assignments.map(a => ({
        id: a.id,
        permissionId: a.permissionId,
        isGranted: a.isGranted,
        expiresAt: a.expiresAt,
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

    logger.error('Error assigning department permissions:', error);
    return NextResponse.json(
      { error: 'Error al asignar permisos al departamento' },
      { status: 500 }
    );
  }
}


// Helper function to get inherited permissions from parent departments
async function getInheritedPermissions(departmentId: string): Promise<any[]> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { parentId: true },
  });

  if (!department?.parentId) {
    return [];
  }

  // Recursively get permissions from parent departments
  const parentPermissions = await getInheritedPermissions(department.parentId);

  // Get direct permissions from immediate parent
  const directParentPermissions = await prisma.departmentPermission.findMany({
    where: {
      departmentId: department.parentId,
      isGranted: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      permission: true,
    },
  });

  return [
    ...parentPermissions,
    ...directParentPermissions.map(dp => ({
      ...dp,
      inheritedFrom: department.parentId,
    })),
  ];
}

// Helper function to get permissions through user roles
async function getRoleBasedPermissions(departmentId: string): Promise<any[]> {
  const users = await prisma.user.findMany({
    where: {
      departmentId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  });

  // Extract unique role permissions
  const rolePermissions = new Map();

  users.forEach(user => {
    if (user.role?.permissions) {
      const roleKey = user.role.id;
      if (!rolePermissions.has(roleKey)) {
        rolePermissions.set(roleKey, {
          role: user.role,
          users: [],
        });
      }
      rolePermissions.get(roleKey).users.push({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
      });
    }
  });

  return Array.from(rolePermissions.values());
}