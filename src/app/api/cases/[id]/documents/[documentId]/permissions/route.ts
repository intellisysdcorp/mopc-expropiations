import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// Validation schemas
const updatePermissionSchema = z.object({
  userId: z.string(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDownload: z.boolean(),
  canShare: z.boolean(),
  canDelete: z.boolean(),
  canManageVersions: z.boolean().optional(),
  expiresAt: z.iso.datetime().optional(),
});

const shareSchema = z.object({
  userIds: z.array(z.string()),
  shareType: z.string().default('DIRECT'),
  message: z.string().optional(),
  expiresAt: z.iso.datetime().optional(),
});

// GET /api/cases/[id]/documents/[documentId]/permissions - Get document permissions
export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, documentId } = await params;
    if (!caseId || !documentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    // Verify case and document exist and user has access
    const [case_, document] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          departmentId: true,
          createdById: true,
          assignedToId: true,
          supervisedById: true,
        },
      }),
      prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          uploadedById: true,
          securityLevel: true,
        },
      }),
    ]);

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.caseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      document.uploadedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!hasAccess && document.securityLevel !== 'PUBLIC') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get document permissions
    const permissions = await prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get document shares
    const shares = await prisma.documentShare.findMany({
      where: { documentId },
      include: {
        sharer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate effective permissions for current user
    const userPermission = await getUserEffectivePermission(
      session.user.id,
      documentId,
      case_,
      document
    );

    return NextResponse.json({
      permissions: permissions.map(perm => ({
        ...perm,
        user: perm.user ? {
          ...perm.user,
          fullName: `${perm.user.firstName} ${perm.user.lastName}`,
        } : null,
        createdAt: perm.createdAt.toISOString(),
        updatedAt: perm.updatedAt.toISOString(),
      })),
      shares: shares.map(share => ({
        ...share,
        sharer: share.sharer ? {
          ...share.sharer,
          fullName: `${share.sharer.firstName} ${share.sharer.lastName}`,
        } : null,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString(),
      })),
      userPermission,
      ownership: {
        isOwner: document.uploadedById === session.user.id,
        isCaseManager: case_.createdById === session.user.id ||
                      case_.assignedToId === session.user.id ||
                      case_.supervisedById === session.user.id,
        hasDepartmentAccess: await hasDepartmentAccess(session.user.id, case_.departmentId),
      },
    });
  } catch (error) {
    logger.error('Error fetching document permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/documents/[documentId]/permissions - Update document permissions
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, documentId } = await params;
    if (!caseId || !documentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }
    const body = await request.json();
    const { action } = body;

    // Verify case and document exist and user has access
    const [case_, document] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          departmentId: true,
          createdById: true,
          assignedToId: true,
          supervisedById: true,
        },
      }),
      prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          uploadedById: true,
          securityLevel: true,
        },
      }),
    ]);

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.caseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Check if user has permission management rights
    const canManagePermissions =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      document.uploadedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!canManagePermissions) {
      return NextResponse.json({ error: 'Permission management denied' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'update_permission': {
        const validatedData = updatePermissionSchema.parse(body);

        // Upsert permission
        result = await prisma.documentPermission.upsert({
          where: {
            documentId_userId_roleId_departmentId: {
              documentId,
              userId: validatedData.userId,
              roleId: null,
              departmentId: null,
            },
          } as any, // Cast to any to handle nullable fields in unique constraint
          update: {
            canView: validatedData.canView,
            canEdit: validatedData.canEdit,
            canDownload: validatedData.canDownload,
            canShare: validatedData.canShare,
            canDelete: validatedData.canDelete,
            expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
            grantedBy: session.user.id,
          },
          create: {
            documentId,
            userId: validatedData.userId,
            canView: validatedData.canView,
            canEdit: validatedData.canEdit,
            canDownload: validatedData.canDownload,
            canShare: validatedData.canShare,
            canDelete: validatedData.canDelete,
            expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
            grantedBy: session.user.id,
          },
        });

        // Create activity log
        await prisma.activity.create({
          data: {
            action: 'UPDATED',
            entityType: 'document',
            entityId: documentId,
            description: `Document permissions updated for user ${validatedData.userId}`,
            userId: session.user.id,
            caseId,
            metadata: {
              documentId,
              targetUserId: validatedData.userId,
              permissions: {
                canView: validatedData.canView,
                canEdit: validatedData.canEdit,
                canDownload: validatedData.canDownload,
                canShare: validatedData.canShare,
                canDelete: validatedData.canDelete,
              },
            },
          },
        });

        break;
      }

      case 'share': {
        const validatedData = shareSchema.parse(body);

        // Create shares for multiple users
        const shares = await Promise.all(
          validatedData.userIds.map(userId =>
            prisma.documentShare.create({
              data: {
                documentId,
                shareToken: `share_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                shareType: validatedData.shareType,
                permissions: { canView: true }, // Basic share permissions
                sharedBy: session.user.id,
                sharedWith: userId,
                message: validatedData.message || null,
                expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
              },
            })
          )
        );

        // Create activity log
        await prisma.activity.create({
          data: {
            action: 'UPLOADED',
            entityType: 'document',
            entityId: documentId,
            description: `Document shared with ${validatedData.userIds.length} user(s)`,
            userId: session.user.id,
            caseId,
            metadata: {
              documentId,
              sharedWithUserIds: validatedData.userIds,
            },
          },
        });

        result = { shares };
        break;
      }

      case 'revoke_permission': {
        const { userId } = body;

        // Remove permission
        result = await prisma.documentPermission.deleteMany({
          where: {
            documentId,
            userId,
          },
        });

        // Remove active shares
        await prisma.documentShare.updateMany({
          where: {
            documentId,
            sharedWith: userId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Create activity log
        await prisma.activity.create({
          data: {
            action: 'DELETED',
            entityType: 'document',
            entityId: documentId,
            description: `Document permissions revoked for user ${userId}`,
            userId: session.user.id,
            caseId,
            metadata: {
              documentId,
              targetUserId: userId,
            },
          },
        });

        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Error updating document permissions:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/documents/[documentId]/permissions - Remove all custom permissions
export async function DELETE(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, documentId } = await params;
    if (!caseId || !documentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    // Verify case and document exist and user has access
    const [case_, document] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          departmentId: true,
          createdById: true,
          assignedToId: true,
          supervisedById: true,
        },
      }),
      prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          caseId: true,
          uploadedById: true,
        },
      }),
    ]);

    if (!case_ || !document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (document.caseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Only document owner or case manager can remove all permissions
    const canManagePermissions =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      document.uploadedById === session.user.id;

    if (!canManagePermissions) {
      return NextResponse.json({ error: 'Permission management denied' }, { status: 403 });
    }

    // Remove all custom permissions
    await prisma.documentPermission.deleteMany({
      where: { documentId },
    });

    // Deactivate all shares
    await prisma.documentShare.updateMany({
      where: {
        documentId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'DELETED',
        entityType: 'document',
        entityId: documentId,
        description: 'All custom document permissions removed',
        userId: session.user.id,
        caseId,
        metadata: {
          documentId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error clearing document permissions:', error);
    return NextResponse.json(
      { error: 'Failed to clear permissions' },
      { status: 500 }
    );
  }
}

// Helper function to calculate user's effective permissions
async function getUserEffectivePermission(
  userId: string,
  documentId: string,
  caseData: any,
  documentData: any
) {
  // Owner has full permissions
  if (documentData.uploadedById === userId) {
    return {
      canView: true,
      canEdit: true,
      canDownload: true,
      canShare: true,
      canDelete: true,
      canManageVersions: true,
      source: 'owner',
    };
  }

  // Case managers have full permissions
  if (caseData.createdById === userId ||
      caseData.assignedToId === userId ||
      caseData.supervisedById === userId) {
    return {
      canView: true,
      canEdit: true,
      canDownload: true,
      canShare: true,
      canDelete: true,
      canManageVersions: true,
      source: 'case_manager',
    };
  }

  // Department administrators have full permissions
  if (await hasDepartmentAccess(userId, caseData.departmentId)) {
    return {
      canView: true,
      canEdit: true,
      canDownload: true,
      canShare: true,
      canDelete: false, // Can't delete unless owner or case manager
      canManageVersions: true,
      source: 'department_admin',
    };
  }

  // Check for explicit permissions
  const permission = await prisma.documentPermission.findFirst({
    where: {
      documentId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
  });

  if (permission) {
    return {
      canView: permission.canView,
      canEdit: permission.canEdit,
      canDownload: permission.canDownload,
      canShare: permission.canShare,
      canDelete: permission.canDelete,
      canManageVersions: false, // Not in the permission model
      source: 'explicit_permission',
    };
  }

  // Check for active shares
  const share = await prisma.documentShare.findFirst({
    where: {
      documentId,
      sharedWith: userId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
  });

  if (share) {
    // Default permissions for shares
    return {
      canView: true,
      canEdit: false,
      canDownload: true,
      canShare: false,
      canDelete: false,
      canManageVersions: false,
      source: 'share',
    };
  }

  // Public documents can be viewed by anyone with case access
  if (documentData.securityLevel === 'PUBLIC') {
    return {
      canView: true,
      canEdit: false,
      canDownload: true,
      canShare: false,
      canDelete: false,
      canManageVersions: false,
      source: 'public_access',
    };
  }

  // Default: no permissions
  return {
    canView: false,
    canEdit: false,
    canDownload: false,
    canShare: false,
    canDelete: false,
    canManageVersions: false,
    source: 'none',
  };
}

async function hasDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      role: {
        select: { permissions: true }
      }
    },
  });

  if (!user) return false;

  const sameDepartment = user.departmentId === departmentId;

  // Handle JSON permissions properly
  const permissions = user.role?.permissions;
  let hasAdminAccess = false;

  if (permissions && typeof permissions === 'object' && permissions !== null) {
    const perms = permissions as any;
    hasAdminAccess = perms.admin || perms.allDepartments || perms.viewAllCases;
  }

  return sameDepartment || hasAdminAccess;
}