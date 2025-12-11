import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentStatus, DocumentSecurityLevel, DocumentActionType } from '@/prisma/client';
import { logger } from '@/lib/logger';

// Types
interface DocumentTag {
  id: string;
  tag: string;
  color: string | null;
}

interface FormattedDocumentTag {
  id: string;
  tag: string;
  color: string;
}

// Validation schemas
const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  securityLevel: z.enum(DocumentSecurityLevel).optional(),
  tags: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  retentionPeriod: z.number().optional(),
  expiresAt: z.iso.datetime().optional(),
});

// GET /api/documents/[id] - Get a specific document
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

    // Get document with permissions check
    const document = await prisma.document.findUnique({
      where: { id },
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
        tagsRelations: {
          select: {
            id: true,
            tag: true,
            color: true,
          },
        },
        permissions: {
          where: {
            OR: [
              { userId: session.user.id },
              { isActive: true },
            ],
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 10,
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        signatures: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            versions: true,
            history: true,
            signatures: true,
            actions: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions (simplified - in real implementation, check role-based permissions)
    const hasPermission =
      document.uploadedById === session.user.id ||
      document.isPublic ||
      document.permissions.length > 0;

    if (!hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Increment view count
    await prisma.document.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
        lastAccessedBy: session.user.id,
      },
    });

    // Create view action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.VIEWED,
        userId: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Format response
    const response = formatDocumentResponse(document);

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[id] - Update document metadata
export async function PUT(
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
    const validatedData = updateDocumentSchema.parse(body);

    // Check if document exists and user has permission
    const existingDocument = await prisma.document.findUnique({
      where: { id },
    });

    if (!existingDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (existingDocument.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Prepare update data with only defined values
    const updateData: any = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.securityLevel !== undefined) updateData.securityLevel = validatedData.securityLevel;
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;
    if (validatedData.metadata !== undefined) updateData.metadata = validatedData.metadata;
    if (validatedData.customFields !== undefined) updateData.customFields = validatedData.customFields;
    if (validatedData.retentionPeriod !== undefined) updateData.retentionPeriod = validatedData.retentionPeriod;
    if (validatedData.expiresAt !== undefined) updateData.expiresAt = new Date(validatedData.expiresAt);
    updateData.updatedAt = new Date();

    // Update document
    const document = await prisma.document.update({
      where: { id },
      data: updateData,
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
        tagsRelations: {
          select: {
            id: true,
            tag: true,
            color: true,
          },
        },
      },
    });

    // Store old values for history
    const changes: any = {};
    if (validatedData.title && validatedData.title !== existingDocument.title) {
      changes.title = { previous: existingDocument.title, new: validatedData.title };
    }
    if (validatedData.description !== undefined && validatedData.description !== existingDocument.description) {
      changes.description = { previous: existingDocument.description, new: validatedData.description };
    }
    if (validatedData.securityLevel && validatedData.securityLevel !== existingDocument.securityLevel) {
      changes.securityLevel = { previous: existingDocument.securityLevel, new: validatedData.securityLevel };
    }

    // Create history entries for changes
    if (Object.keys(changes).length > 0) {
      for (const [field, change] of Object.entries(changes)) {
        await prisma.documentHistory.create({
          data: {
            documentId: id,
            action: DocumentActionType.EDITED,
            field,
            previousValue: JSON.stringify((change as any).previous),
            newValue: JSON.stringify((change as any).new),
            description: `Updated ${field}`,
            userId: session.user.id,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        });
      }
    }

    // Update tags if provided
    if (validatedData.tags !== undefined) {
      // Delete existing tags
      await prisma.documentTag.deleteMany({
        where: { documentId: id },
      });

      // Create new tags
      const tags = validatedData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      for (const tag of tags) {
        await prisma.documentTag.create({
          data: {
            documentId: id,
            tag,
          },
        });
      }
    }

    // Create edit action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.EDITED,
        userId: session.user.id,
        metadata: { fields: Object.keys(changes) },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Format response
    const response = formatDocumentResponseSimple(document);

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error updating document:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if document exists and user has permission
    const existingDocument = await prisma.document.findUnique({
      where: { id },
    });

    if (!existingDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (existingDocument.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Soft delete by marking as archived
    await prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedBy: session.user.id,
      },
    });

    // Create delete action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.DELETED,
        userId: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.DELETED,
        description: 'Document deleted',
        userId: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDocumentTags(tags: DocumentTag[]): FormattedDocumentTag[] {
  return tags.map((tag: DocumentTag): FormattedDocumentTag => ({
    id: tag.id,
    tag: tag.tag,
    color: tag.color || '#000000',
  }));
}

function formatUserWithFullName(user: { firstName: string; lastName: string; [key: string]: any }) {
  return {
    ...user,
    fullName: `${user.firstName} ${user.lastName}`,
  };
}

function formatDocumentResponse(document: any) {
  return {
    ...document,
    uploadedBy: formatUserWithFullName(document.uploadedBy),
    tags: formatDocumentTags(document.tagsRelations),
    versions: document.versions?.map((version: any) => ({
      ...version,
      creator: formatUserWithFullName(version.creator),
      fileSizeFormatted: formatFileSize(version.fileSize),
      createdAt: version.createdAt.toISOString(),
    })),
    history: document.history?.map((entry: any) => ({
      ...entry,
      user: formatUserWithFullName(entry.user),
      createdAt: entry.createdAt.toISOString(),
    })),
    signatures: document.signatures?.map((signature: any) => ({
      ...signature,
      user: formatUserWithFullName(signature.user),
      createdAt: signature.createdAt.toISOString(),
    })),
    fileSizeFormatted: formatFileSize(document.fileSize),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    expiresAt: document.expiresAt?.toISOString(),
  };
}

function formatDocumentResponseSimple(document: any) {
  return {
    ...document,
    uploadedBy: formatUserWithFullName(document.uploadedBy),
    tags: formatDocumentTags(document.tagsRelations),
    fileSizeFormatted: formatFileSize(document.fileSize),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    expiresAt: document.expiresAt?.toISOString(),
  };
}