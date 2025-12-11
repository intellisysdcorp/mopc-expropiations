import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentActionType } from '@/prisma/client';
import { logger } from '@/lib/logger';

// Type for permission with includes
type PermissionWithIncludes = {
  id: string;
  documentId: string;
  userId: string | null;
  roleId: string | null;
  departmentId: string | null;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDownload: boolean;
  canShare: boolean;
  canSign: boolean;
  canApprove: boolean;
  expiresAt: Date | null;
  isActive: boolean;
  grantedBy: string;
  reason: string | null;
  grantedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  role?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

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
  expiresAt: z.iso.datetime().optional(),
  reason: z.string().optional(),
});

// GET /api/documents/[id]/permissions - Get document permissions
export async function GET(
  _request: NextRequest,
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

    const docPermissionWhereClause = {
      documentId: id,
      userId: validatedData.userId || null,
      roleId: validatedData.roleId || null,
      departmentId: validatedData.departmentId || null,
    }

    if (validatedData.userId) docPermissionWhereClause.userId = validatedData.userId;
    if (validatedData.roleId) docPermissionWhereClause.roleId = validatedData.roleId;
    if (validatedData.departmentId) docPermissionWhereClause.departmentId = validatedData.departmentId;

    // Check if permission already exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: docPermissionWhereClause,
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

    const docPermissionCreateObject: any = {
      data: {
        documentId: id,
        canView: validatedData.canView,
        canEdit: validatedData.canEdit,
        canDelete: validatedData.canDelete,
        canDownload: validatedData.canDownload,
        canShare: validatedData.canShare,
        canSign: validatedData.canSign,
        canApprove: validatedData.canApprove,
        grantedBy: session.user.id,
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
    }

    if (validatedData.userId) docPermissionCreateObject.data.userId = validatedData.userId
    if (validatedData.roleId) docPermissionCreateObject.data.roleId = validatedData.roleId
    if (validatedData.departmentId) docPermissionCreateObject.data.departmentId = validatedData.departmentId
    if (validatedData.reason) docPermissionCreateObject.data.reason = validatedData.reason
    if (validatedData.expiresAt) docPermissionCreateObject.data.expiresAt = new Date(validatedData.expiresAt)

    // Create permission
    const permission = await prisma.documentPermission.create(docPermissionCreateObject);

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
    const permissionWithIncludes = permission as PermissionWithIncludes;
    const response: any = {
      ...permissionWithIncludes,
      expiresAt: permissionWithIncludes.expiresAt?.toISOString(),
      createdAt: permissionWithIncludes.createdAt.toISOString(),
      updatedAt: permissionWithIncludes.updatedAt.toISOString(),
    };

    if (permissionWithIncludes.user) {
      response.user = {
        ...permissionWithIncludes.user,
        fullName: `${permissionWithIncludes.user.firstName} ${permissionWithIncludes.user.lastName}`,
      }
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating document permission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create document permission' },
      { status: 500 }
    );
  }
}