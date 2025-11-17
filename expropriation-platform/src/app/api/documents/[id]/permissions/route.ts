import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentActionType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createPermissionSchema = z.object({
  userId: z.string().optional(),
  roleId: z.string().optional(),
  departmentId: z.string().optional(),
  canView: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canDownload: z.boolean().default(false),
  canShare: z.boolean().default(false),
  canSign: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

const updatePermissionSchema = z.object({
  canView: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canShare: z.boolean().optional(),
  canSign: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/documents/[id]/permissions - Get document permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if document exists and user has permission to view permissions
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only document owner or users with manage permissions can view permissions
    const canManagePermissions = document.uploadedById === session.user.id;

    if (!canManagePermissions) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get permissions
    const permissions = await prisma.documentPermission.findMany({
      where: { documentId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format permissions
    const formattedPermissions = permissions.map(permission => ({
      ...permission,
      user: permission.user ? {
        ...permission.user,
        fullName: `${permission.user.firstName} ${permission.user.lastName}`,
      } : null,
      expiresAt: permission.expiresAt?.toISOString(),
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      documentId: id,
      permissions: formattedPermissions,
      documentTitle: document.title,
    });
  } catch (error) {
    logger.error('Error fetching document permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document permissions' },
      { status: 500 }
    );
  }
}

// POST /api/documents/[id]/permissions - Create new permission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = createPermissionSchema.parse(body);

    // Validate that at least one permission target is provided
    if (!validatedData.userId && !validatedData.roleId && !validatedData.departmentId) {
      return NextResponse.json(
        { error: 'At least one of userId, roleId, or departmentId must be provided' },
        { status: 400 }
      );
    }

    // Check if document exists and user has permission to manage permissions
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if permission already exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId: id,
        userId: validatedData.userId,
        roleId: validatedData.roleId,
        departmentId: validatedData.departmentId,
      },
    });

    if (existingPermission) {
      return NextResponse.json(
        { error: 'Permission already exists for this target' },
        { status: 409 }
      );
    }

    // Validate target exists
    if (validatedData.userId) {
      const user = await prisma.user.findUnique({
        where: { id: validatedData.userId },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    if (validatedData.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: validatedData.roleId },
      });
      if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      }
    }

    if (validatedData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: validatedData.departmentId },
      });
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
    }

    // Create permission
    const permission = await prisma.documentPermission.create({
      data: {
        documentId: id,
        userId: validatedData.userId,
        roleId: validatedData.roleId,
        departmentId: validatedData.departmentId,
        canView: validatedData.canView,
        canEdit: validatedData.canEdit,
        canDelete: validatedData.canDelete,
        canDownload: validatedData.canDownload,
        canShare: validatedData.canShare,
        canSign: validatedData.canSign,
        canApprove: validatedData.canApprove,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        grantedBy: session.user.id,
        reason: validatedData.reason,
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
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create permission action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.TAGGED, // Using TAGGED for permission management
        userId: session.user.id,
        metadata: {
          permissionId: permission.id,
          target: validatedData.userId || validatedData.roleId || validatedData.departmentId,
          targetType: validatedData.userId ? 'user' : validatedData.roleId ? 'role' : 'department',
          permissions: {
            canView: validatedData.canView,
            canEdit: validatedData.canEdit,
            canDelete: validatedData.canDelete,
            canDownload: validatedData.canDownload,
            canShare: validatedData.canShare,
            canSign: validatedData.canSign,
            canApprove: validatedData.canApprove,
          },
        },
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.TAGGED, // Using TAGGED for permission management
        description: `Permission granted to ${validatedData.userId ? 'user' : validatedData.roleId ? 'role' : 'department'}`,
        userId: session.user.id,
        newValue: JSON.stringify({
          target: validatedData.userId || validatedData.roleId || validatedData.departmentId,
          permissions: {
            canView: validatedData.canView,
            canEdit: validatedData.canEdit,
            canDelete: validatedData.canDelete,
            canDownload: validatedData.canDownload,
            canShare: validatedData.canShare,
            canSign: validatedData.canSign,
            canApprove: validatedData.canApprove,
          },
          reason: validatedData.reason,
        }),
      },
    });

    // Format response
    const response = {
      ...permission,
      user: permission.user ? {
        ...permission.user,
        fullName: `${permission.user.firstName} ${permission.user.lastName}`,
      } : null,
      expiresAt: permission.expiresAt?.toISOString(),
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating document permission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create document permission' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[id]/permissions/[permissionId] - Update permission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, permissionId } = await params;
    const body = await request.json();
    const validatedData = updatePermissionSchema.parse(body);

    // Check if document exists and user has permission to manage permissions
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if permission exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: {
        id: permissionId,
        documentId: id,
      },
    });

    if (!existingPermission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Update permission
    const permission = await prisma.documentPermission.update({
      where: { id: permissionId },
      data: {
        canView: validatedData.canView,
        canEdit: validatedData.canEdit,
        canDelete: validatedData.canDelete,
        canDownload: validatedData.canDownload,
        canShare: validatedData.canShare,
        canSign: validatedData.canSign,
        canApprove: validatedData.canApprove,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        isActive: validatedData.isActive,
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
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create permission update action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.EDITED,
        userId: session.user.id,
        metadata: {
          permissionId: permissionId,
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.EDITED,
        field: 'permissions',
        description: `Permission updated for ${existingPermission.userId || existingPermission.roleId || existingPermission.departmentId}`,
        userId: session.user.id,
        previousValue: JSON.stringify({
          canView: existingPermission.canView,
          canEdit: existingPermission.canEdit,
          canDelete: existingPermission.canDelete,
          canDownload: existingPermission.canDownload,
          canShare: existingPermission.canShare,
          canSign: existingPermission.canSign,
          canApprove: existingPermission.canApprove,
          expiresAt: existingPermission.expiresAt,
          isActive: existingPermission.isActive,
        }),
        newValue: JSON.stringify(validatedData),
      },
    });

    // Format response
    const response = {
      ...permission,
      user: permission.user ? {
        ...permission.user,
        fullName: `${permission.user.firstName} ${permission.user.lastName}`,
      } : null,
      expiresAt: permission.expiresAt?.toISOString(),
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error updating document permission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update document permission' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id]/permissions/[permissionId] - Delete permission
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, permissionId } = await params;

    // Check if document exists and user has permission to manage permissions
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if permission exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: {
        id: permissionId,
        documentId: id,
      },
    });

    if (!existingPermission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Delete permission
    await prisma.documentPermission.delete({
      where: { id: permissionId },
    });

    // Create permission deletion action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.DELETED,
        userId: session.user.id,
        metadata: {
          permissionId,
          target: existingPermission.userId || existingPermission.roleId || existingPermission.departmentId,
          targetType: existingPermission.userId ? 'user' : existingPermission.roleId ? 'role' : 'department',
        },
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.DELETED,
        description: `Permission revoked for ${existingPermission.userId || existingPermission.roleId || existingPermission.departmentId}`,
        userId: session.user.id,
        previousValue: JSON.stringify({
          target: existingPermission.userId || existingPermission.roleId || existingPermission.departmentId,
          permissions: {
            canView: existingPermission.canView,
            canEdit: existingPermission.canEdit,
            canDelete: existingPermission.canDelete,
            canDownload: existingPermission.canDownload,
            canShare: existingPermission.canShare,
            canSign: existingPermission.canSign,
            canApprove: existingPermission.canApprove,
          },
        }),
      },
    });

    return NextResponse.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document permission:', error);
    return NextResponse.json(
      { error: 'Failed to delete document permission' },
      { status: 500 }
    );
  }
}