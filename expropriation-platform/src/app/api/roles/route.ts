import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { normalizePermissions } from '@/types/permissions';
import { logger } from '@/lib/logger';

// Base role schema
const baseRoleSchema = z.object({
  name: z.string().min(1, 'El nombre del rol es requerido'),
  description: z.string().nullable().optional(),
  permissions: z.record(z.string(), z.boolean()).transform(normalizePermissions),
  isActive: z.boolean().optional(),
});

// Derived schemas
const createRoleSchema = baseRoleSchema.omit({ isActive: true }).extend({
  isActive: z.boolean().default(true),
});

const updateRoleSchema = baseRoleSchema.partial();

// Helper functions
const handleZodError = (error: z.ZodError) => {
  return NextResponse.json(
    {
      error: 'Datos inválidos',
      details: error.issues,
      issues: error.issues.map((issue: any) => ({
        field: Array.isArray(issue.path) ? issue.path.join('.') : issue.path,
        message: issue.message,
        code: issue.code,
        expected: issue.expected,
        received: issue.received
      }))
    },
    { status: 400 }
  );
};

const buildCreateData = (validatedData: any) => {
  const { description, isActive, ...requiredData } = validatedData;
  const createData: any = { ...requiredData };

  if (description !== undefined) createData.description = description;
  if (isActive !== undefined) createData.isActive = isActive;

  return createData;
};

const buildUpdateData = (updateData: any) => {
  const cleanUpdateData: any = {};

  if (updateData.name !== undefined) cleanUpdateData.name = updateData.name;
  if (updateData.description !== undefined) {
    cleanUpdateData.description = updateData.description === null ? null : updateData.description;
  }
  if (updateData.isActive !== undefined) cleanUpdateData.isActive = updateData.isActive;
  if (updateData.permissions !== undefined) {
    cleanUpdateData.permissions = normalizePermissions(updateData.permissions);
  }

  return cleanUpdateData;
};

const sanitizeRoleResponse = (role: any) => ({
  ...role,
});

// GET /api/roles - List roles with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const includeUserCount = searchParams.get('includeUserCount') === 'true';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get roles with optional user count
    const queryOptions: any = {
      where,
      orderBy: { [sortBy]: sortOrder },
    };

    if (includeUserCount) {
      queryOptions.include = {
        _count: {
          select: {
            users: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      };
    }

    const roles = await prisma.role.findMany(queryOptions);

    // Format response
    const sanitizedRoles = roles.map((role: any) => {
      const result = { ...role };

      if (includeUserCount && role._count) {
        result.userCount = role._count.users || 0;
        delete result._count;
      }

      return result;
    });

    return NextResponse.json(sanitizedRoles);
  } catch (error) {
    logger.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Error al obtener roles' },
      { status: 500 }
    );
  }
}

// POST /api/roles - Create a new role
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.info('No session user found');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage users/roles
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para crear roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createRoleSchema.parse(body);

    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: validatedData.name },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'El nombre del rol ya existe' },
        { status: 400 }
      );
    }

    // Create role
    const role = await prisma.role.create({
      data: buildCreateData(validatedData),
    });

    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'role',
      entityId: role.id,
      description: `Rol creado: ${role.name}`,
      metadata: {
        roleName: role.name,
        roleDescription: role.description,
        permissions: role.permissions,
      },
    });

    return NextResponse.json({ ...sanitizeRoleResponse(role), userCount: 0 }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(error);
    }

    logger.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Error al crear rol', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/roles - Update a role
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage users/roles
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para actualizar roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID del rol es requerido' },
        { status: 400 }
      );
    }

    // Validate the request body
    updateRoleSchema.parse(updateData);

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 404 }
      );
    }

    // Check if new role name already exists (if name is being updated)
    if (updateData.name && updateData.name !== existingRole.name) {
      const duplicateRole = await prisma.role.findUnique({
        where: { name: updateData.name },
      });

      if (duplicateRole) {
        return NextResponse.json(
          { error: 'El nombre del rol ya existe' },
          { status: 400 }
        );
      }
    }

    // Update role - build clean update data
    const cleanUpdateData: any = {};

    // Only include fields that are actually provided in the request
    if (updateData.name !== undefined) {
      cleanUpdateData.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      cleanUpdateData.description = updateData.description === null ? null : updateData.description;
    }
    if (updateData.isActive !== undefined) {
      cleanUpdateData.isActive = updateData.isActive;
    }
    if (updateData.permissions !== undefined) {
      cleanUpdateData.permissions = normalizePermissions(updateData.permissions);
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: cleanUpdateData,
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'role',
      entityId: updatedRole.id,
      description: `Rol actualizado: ${updatedRole.name}`,
      metadata: {
        roleName: updatedRole.name,
        roleDescription: updatedRole.description,
        permissions: updatedRole.permissions,
        previousData: {
          name: existingRole.name,
          description: existingRole.description,
          permissions: existingRole.permissions,
        },
      },
    });

    // Remove sensitive data and format response
    const sanitizedRole = {
      ...updatedRole,
    };

    return NextResponse.json(sanitizedRole);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Error al actualizar rol' },
      { status: 500 }
    );
  }
}

// DELETE /api/roles - Delete a role
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage users/roles
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para eliminar roles' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID del rol es requerido' },
        { status: 400 }
      );
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 404 }
      );
    }

    // Check if role has active users
    if (existingRole._count?.users > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un rol que tiene usuarios asignados' },
        { status: 400 }
      );
    }

    // Soft delete role
    const deletedRole = await prisma.role.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'role',
      entityId: deletedRole.id,
      description: `Rol eliminado: ${existingRole.name}`,
      metadata: {
        roleName: existingRole.name,
        roleDescription: existingRole.description,
        permissions: existingRole.permissions,
      },
    });

    return NextResponse.json(
      { message: 'Rol eliminado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Error al eliminar rol' },
      { status: 500 }
    );
  }
}