import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for permission assignment
const permissionAssignmentSchema = z.object({
  permissionIds: z.array(z.string()).min(1, 'Selecciona al menos un permiso'),
  isGranted: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/departments/[id]/permissions - Get department permissions
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
      select: { id: true, name: true, code: true, parentId },
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
        departmentId: (await params).id,
      },
      include: {
        permission: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Get inherited permissions from parent departments
    const inheritedPermissions = await getInheritedPermissions((await params).id);

    // Get permissions through user roles
    const roleBasedPermissions = await getRoleBasedPermissions((await params).id);

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
        { error: 'No tiene permisos para asignar permisos a departamentos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permissionIds, isGranted, expiresAt } = permissionAssignmentSchema.parse(body);

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
              departmentId: (await params).id,
              permissionId,
            },
          },
        });

        if (existing) {
          // Update existing assignment
          return await prisma.departmentPermission.update({
            where: {
              departmentId_permissionId: {
                departmentId: (await params).id,
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
              departmentId: (await params).id,
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
      entityId: (await params).id,
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
        { error: 'Datos inválidos', details: error.errors },
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

// PUT /api/departments/[id]/permissions/[permissionId] - Update specific permission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: departmentId, permissionId } = await params;
    const body = await request.json();
    const { isGranted, expiresAt } = permissionAssignmentSchema.partial().parse(body);

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

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permiso no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.departmentPermission.findUnique({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Asignación de permiso no encontrada' },
        { status: 404 }
      );
    }

    // Update assignment
    const assignment = await prisma.departmentPermission.update({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
      data: {
        isGranted: isGranted !== undefined ? isGranted : existingAssignment.isGranted,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existingAssignment.expiresAt,
        assignedBy: session.user.id,
      },
      include: {
        permission: true,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: departmentId,
      description: `Permiso actualizado para el departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        permission: {
          id: permission.id,
          name: permission.name,
          type: permission.type,
        },
        previousState: {
          isGranted: existingAssignment.isGranted,
          expiresAt: existingAssignment.expiresAt,
        },
        newState: {
          isGranted: assignment.isGranted,
          expiresAt: assignment.expiresAt,
        },
      },
    });

    return NextResponse.json({
      message: `Permiso ${permission.name} actualizado correctamente`,
      assignment: {
        id: assignment.id,
        permission: assignment.permission,
        isGranted: assignment.isGranted,
        expiresAt: assignment.expiresAt,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating department permission:', error);
    return NextResponse.json(
      { error: 'Error al actualizar permiso del departamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id]/permissions/[permissionId] - Remove permission assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: departmentId, permissionId } = await params;

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

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permiso no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.departmentPermission.findUnique({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Asignación de permiso no encontrada' },
        { status: 404 }
      );
    }

    // Delete assignment
    await prisma.departmentPermission.delete({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: departmentId,
      description: `Permiso eliminado del departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        permission: {
          id: permission.id,
          name: permission.name,
          type: permission.type,
        },
        previousAssignment: existingAssignment,
      },
    });

    return NextResponse.json({
      message: `Permiso ${permission.name} eliminado correctamente`,
    });
  } catch (error) {
    logger.error('Error removing department permission:', error);
    return NextResponse.json(
      { error: 'Error al eliminar permiso del departamento' },
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