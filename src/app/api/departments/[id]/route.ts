import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { updateDepartmentSchema } from '@/lib/validators/department-validator';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// GET /api/departments/[id] - Get specific department
export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const department = await prisma.department.findUnique({
      where: { id: (await params).id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        headUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        children: {
          select: { id: true, name: true, code: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        users: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: { id: true, name: true },
            },
            createdAt: true,
          },
          orderBy: { firstName: 'asc' },
        },
        _count: {
          select: {
            users: {
              where: { isActive: true, deletedAt: null },
            },
            cases: true,
            children: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Return formatted response
    const sanitizedDepartment = {
      ...department,
      userCount: department._count.users,
      caseCount: department._count.cases,
      childCount: department._count.children,
      _count: undefined,
    };

    return NextResponse.json(sanitizedDepartment);
  } catch (error) {
    logger.error('Error fetching department:', error);
    return NextResponse.json(
      { error: 'Error al obtener departamento' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Update department
export async function PUT(
  request: NextRequest,
  { params }: URLParams
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
        { error: 'No tiene permisos para actualizar departamentos' },
        { status: 403 }
      );
    }

    
    // Check if department exists
    const existingDept = await prisma.department.findUnique({
      where: { id: (await params).id },
    });
    
    if (!existingDept) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateDepartmentSchema.parse(body);

    // Check if department code already exists (if being updated)
    if (validatedData.code && validatedData.code !== existingDept.code) {
      const codeExists = await prisma.department.findUnique({
        where: { code: validatedData.code },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: 'El código de departamento ya existe' },
          { status: 400 }
        );
      }
    }

    // Validate parentId if provided
    if (validatedData.parentId) {
      const parentDept = await prisma.department.findUnique({
        where: { id: validatedData.parentId },
      });

      if (!parentDept) {
        return NextResponse.json(
          { error: 'Departamento padre no encontrado' },
          { status: 400 }
        );
      }

      // Prevent circular reference
      if (validatedData.parentId === (await params).id) {
        return NextResponse.json(
          { error: 'Un departamento no puede ser su propio padre' },
          { status: 400 }
        );
      }

      // Prevent creating cycles in hierarchy
      const isDescendant = await checkIsDescendant(validatedData.parentId, (await params).id);
      if (isDescendant) {
        return NextResponse.json(
          { error: 'No se puede establecer un departamento hijo como padre' },
          { status: 400 }
        );
      }
    }

    // Validate headUserId if provided
    if (validatedData.headUserId !== undefined && validatedData.headUserId) {
      const headUser = await prisma.user.findUnique({
        where: { id: validatedData.headUserId },
      });

      if (!headUser) {
        return NextResponse.json(
          { error: 'Usuario designado como jefe no encontrado' },
          { status: 400 }
        );
      }
    }

    // Create update data object with required fields first
    const updateData: Record<string, unknown> = {};

    // Add nullable properties conditionally
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.code !== undefined) updateData.code = validatedData.code;
    if (validatedData.parentId !== undefined) updateData.parentId = validatedData.parentId;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.headUserId !== undefined) updateData.headUserId = validatedData.headUserId;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;

    // Update department
    const department = await prisma.department.update({
      where: { id: (await params).id },
      data: updateData,
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        headUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        children: {
          select: { id: true, name: true, code: true, isActive: true },
        },
        _count: {
          select: {
            users: true,
            cases: true,
            children: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: department.id,
      description: `Departamento actualizado: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        previousData: existingDept,
        newData: validatedData,
      },
    });

    // Return formatted response
    const sanitizedDepartment = {
      ...department,
      userCount: department._count?.users || 0,
      caseCount: department._count?.cases || 0,
      childCount: department._count?.children || 0,
      _count: undefined,
    };

    return NextResponse.json(sanitizedDepartment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Error al actualizar departamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Delete department
export async function DELETE(
  _request: NextRequest,
  { params }: URLParams
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
        { error: 'No tiene permisos para eliminar departamentos' },
        { status: 403 }
      );
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: (await params).id },
      include: {
        _count: {
          select: {
            users: {
              where: { isActive: true, deletedAt: null },
            },
            cases: true,
            children: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Prevent deletion if department has users or cases
    if (department._count.users > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un departamento con usuarios activos' },
        { status: 400 }
      );
    }

    if (department._count.cases > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un departamento con casos asignados' },
        { status: 400 }
      );
    }

    if (department._count.children > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un departamento con departamentos hijos' },
        { status: 400 }
      );
    }

    // Delete department
    await prisma.department.delete({
      where: { id: (await params).id },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'department',
      entityId: (await params).id,
      description: `Departamento eliminado: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
      },
    });

    return NextResponse.json({ message: 'Departamento eliminado correctamente' });
  } catch (error) {
    logger.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Error al eliminar departamento' },
      { status: 500 }
    );
  }
}

// Helper function to check if a department is a descendant of another
async function checkIsDescendant(potentialParentId: string, currentId: string): Promise<boolean> {
  const department = await prisma.department.findUnique({
    where: { id: potentialParentId },
    select: { parentId: true },
  });

  if (!department) {
    return false;
  }

  if (department.parentId === currentId) {
    return true;
  }

  if (department.parentId) {
    return await checkIsDescendant(department.parentId, currentId);
  }

  return false;
}