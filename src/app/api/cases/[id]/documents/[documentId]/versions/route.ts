import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createDocumentVersion } from '@/lib/documents';
import { URLParams } from '@/types';

// Validation schemas
const createVersionSchema = z.object({
  changeDescription: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  isDraft: z.boolean().default(true),
});

// GET /api/cases/[id]/documents/[documentId]/versions - Get document versions
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

    // Get document versions
    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    // Get version history/activity
    const versionHistory = await prisma.documentHistory.findMany({
      where: {
        documentId,
        action: {
          in: ['VERSIONED', 'UPLOADED', 'RESTORED']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Format versions
    const formattedVersions = versions.map(version => ({
      ...version,
      creator: {
        ...version.creator,
        fullName: `${version.creator.firstName} ${version.creator.lastName}`,
      },
      fileSizeFormatted: formatFileSize(version.fileSize),
      createdAt: version.createdAt.toISOString(),
    }));

    const formattedHistory = versionHistory.map(history => ({
      ...history,
      user: {
        ...history.user,
        fullName: `${history.user.firstName} ${history.user.lastName}`,
      },
      createdAt: history.createdAt.toISOString(),
    }));

    return NextResponse.json({
      versions: formattedVersions,
      history: formattedHistory,
      currentVersion: document,
    });
  } catch (error) {
    logger.error('Error fetching document versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document versions' },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/documents/[documentId]/versions - Create new version
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

    // Parse form data (file upload) or JSON (metadata update)
    const contentType = request.headers.get('content-type');
    let file: File | null = null;
    let versionData: any = {};

    if (contentType?.includes('multipart/form-data')) {
      // File upload case
      const formData = await request.formData();
      file = formData.get('file') as File;
      versionData = JSON.parse(formData.get('versionData') as string);
    } else {
      // Metadata update case
      versionData = await request.json();
    }

    const validatedData = createVersionSchema.parse(versionData);

    // Verify case and document exist and user has access
    const [case_, currentDocument] = await Promise.all([
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
      }),
    ]);

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!currentDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (currentDocument.caseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Check version permissions (owner or case manager)
    const canVersion =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      currentDocument.uploadedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!canVersion) {
      return NextResponse.json({ error: 'Version creation permission denied' }, { status: 403 });
    }

    // Get next version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version || currentDocument.version) + 1;

    let newVersion;

    if (file) {
      // Handle file upload for new version
      newVersion = await createDocumentVersion({
        documentId,
        file,
        versionData: validatedData,
        userId: session.user.id,
        versionNumber: nextVersion,
      });
    } else {
      // Create metadata-only version (no file change)
      newVersion = await prisma.documentVersion.create({
        data: {
          documentId,
          version: nextVersion,
          title: validatedData.title || currentDocument.title,
          description: validatedData.description || null,
          fileName: currentDocument.fileName,
          filePath: currentDocument.filePath,
          fileSize: currentDocument.fileSize,
          mimeType: currentDocument.mimeType,
          fileHash: currentDocument.fileHash || null,
          changeSummary: validatedData.changeDescription || null,
          isPublished: !validatedData.isDraft,
          createdBy: session.user.id,
          diffData: validatedData.customFields || {},
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    }

    // Update previous version to not be latest
    await prisma.document.updateMany({
      where: { id: documentId },
      data: { isLatest: false },
    });

    const updateObject = {
      where: { id: documentId },
      data: {
        title: validatedData.title || currentDocument.title,
        version: nextVersion,
        isLatest: true,
        isDraft: validatedData.isDraft,
        updatedAt: new Date(),
        metadata: (validatedData.customFields || currentDocument.metadata) as any,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
      },
    }

    if (validatedData.description) {
      (updateObject.data as any).description = validatedData.description;
    }

    // Update main document record
    const updatedDocument = await prisma.document.update(updateObject);

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId,
        action: file ? 'UPLOADED' : 'EDITED',
        description: `Version ${nextVersion} created: ${validatedData.changeDescription || 'Document updated'}`,
        userId: session.user.id,
        previousValue: JSON.stringify({ version: currentDocument.version }),
        newValue: JSON.stringify({ version: nextVersion }),
        metadata: {
          versionNumber: nextVersion,
          changeDescription: validatedData.changeDescription,
          hasFile: !!file,
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'UPDATED',
        entityType: 'document',
        entityId: documentId,
        description: `New version ${nextVersion} created for document: ${updatedDocument.title}`,
        userId: session.user.id,
        caseId,
        metadata: {
          documentId,
          documentTitle: updatedDocument.title,
          version: nextVersion,
          changeDescription: validatedData.changeDescription,
        },
      },
    });

    return NextResponse.json({
      document: updatedDocument,
      version: newVersion,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating document version:', error);
    return NextResponse.json(
      { error: 'Failed to create document version' },
      { status: 500 }
    );
  }
}


// Helper functions
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
  const permissions = user.role?.permissions as any;
  const hasAdminAccess = permissions?.admin ||
                        permissions?.allDepartments ||
                        permissions?.viewAllCases;

  return sameDepartment || hasAdminAccess;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}