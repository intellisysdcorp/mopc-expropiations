import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentActionType, type Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const updatePermissionSchema = z.object({
  canView: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canShare: z.boolean().optional(),
  canSign: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  expiresAt: z.iso.datetime().optional(),
  isActive: z.boolean().optional(),
});

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
    const updateData: Prisma.DocumentPermissionUpdateInput = {};
    if (validatedData.canView !== undefined) updateData.canView = validatedData.canView;
    if (validatedData.canEdit !== undefined) updateData.canEdit = validatedData.canEdit;
    if (validatedData.canDelete !== undefined) updateData.canDelete = validatedData.canDelete;
    if (validatedData.canDownload !== undefined) updateData.canDownload = validatedData.canDownload;
    if (validatedData.canShare !== undefined) updateData.canShare = validatedData.canShare;
    if (validatedData.canSign !== undefined) updateData.canSign = validatedData.canSign;
    if (validatedData.canApprove !== undefined) updateData.canApprove = validatedData.canApprove;
    if (validatedData.expiresAt !== undefined) updateData.expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt) : null;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const permission = await prisma.documentPermission.update({
      where: { id: permissionId },
      data: updateData,
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
          permissionId,
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
    const baseResponse: any = { ...permission };

    // Conditionally add nullable properties
    if (permission.user) {
      baseResponse.user = {
        ...permission.user,
        fullName: `${permission.user.firstName} ${permission.user.lastName}`,
      };
    }

    if (permission.expiresAt) {
      baseResponse.expiresAt = permission.expiresAt.toISOString();
    }

    if (permission.createdAt) {
      baseResponse.createdAt = permission.createdAt.toISOString();
    }

    if (permission.updatedAt) {
      baseResponse.updatedAt = permission.updatedAt.toISOString();
    }

    const response = baseResponse;

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error updating document permission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
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
  _request: NextRequest,
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
