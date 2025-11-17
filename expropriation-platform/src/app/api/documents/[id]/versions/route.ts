import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { DocumentActionType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createVersionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  changeSummary: z.string().optional(),
  isMajorVersion: z.boolean().default(false),
});

// GET /api/documents/[id]/versions - Get document versions
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

    // Check if document exists and user has permission
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

    // Check permissions (simplified - in real implementation, check role-based permissions)
    const hasPermission =
      document.uploadedById === session.user.id ||
      document.isPublic;

    if (!hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get versions
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
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

    // Format response
    const formattedVersions = versions.map(version => ({
      ...version,
      creator: {
        ...version.creator,
        fullName: `${version.creator.firstName} ${version.creator.lastName}`,
      },
      fileSizeFormatted: formatFileSize(version.fileSize),
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString(),
    }));

    return NextResponse.json({
      documentId: id,
      documentTitle: document.title,
      currentVersion: document.version,
      versions: formattedVersions,
    });
  } catch (error) {
    logger.error('Error fetching document versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document versions' },
      { status: 500 }
    );
  }
}

// POST /api/documents/[id]/versions - Create new document version
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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const versionData = JSON.parse(formData.get('versionData') as string);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate version data
    const validatedData = createVersionSchema.parse(versionData);

    // Check if document exists and user has permission
    const existingDocument = await prisma.document.findUnique({
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

    if (!existingDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (existingDocument.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine new version number
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = validatedData.isMajorVersion
      ? Math.floor((lastVersion?.version || 0) / 10) * 10 + 10
      : (lastVersion?.version || 0) + 1;

    // Create date directory for new version
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateDir = path.join(uploadDir, String(year), month, day);
    await fs.mkdir(dateDir, { recursive: true });

    // Generate unique file path for new version
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.name);
    const name = path.basename(file.name, ext);
    const fileName = `${timestamp}-${random}-${name}_v${newVersionNumber}${ext}`;
    const filePath = path.join(dateDir, fileName);

    // Save new version file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Calculate file hash
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Create new version record
    const newVersion = await prisma.documentVersion.create({
      data: {
        documentId: id,
        version: newVersionNumber,
        title: validatedData.title,
        description: validatedData.description,
        fileName,
        filePath: path.relative(process.cwd(), filePath),
        fileSize: file.size,
        mimeType: file.type,
        fileHash,
        changeSummary: validatedData.changeSummary,
        isMajorVersion: validatedData.isMajorVersion,
        isPublished: false,
        isActive: true,
        createdBy: session.user.id,
        previousVersionId: lastVersion?.id || null,
        checksum: fileHash,
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
        previousVersion: {
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
      },
    });

    // Update main document if this version should be published
    if (validatedData.isMajorVersion) {
      await prisma.document.update({
        where: { id },
        data: {
          version: newVersionNumber,
          filePath: newVersion.filePath,
          fileSize: file.size,
          fileHash,
          updatedAt: new Date(),
        },
      });
    }

    // Create version action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.VERSIONED,
        userId: session.user.id,
        metadata: {
          version: newVersionNumber,
          isMajorVersion: validatedData.isMajorVersion,
          fileName,
          fileSize: file.size,
        },
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.VERSIONED,
        description: `New version ${newVersionNumber} created: ${validatedData.title}`,
        userId: session.user.id,
        newValue: JSON.stringify({
          version: newVersionNumber,
          title: validatedData.title,
          changeSummary: validatedData.changeSummary,
        }),
        fileSize: file.size,
        fileName,
        filePath: newVersion.filePath,
      },
    });

    // Format response
    const response = {
      ...newVersion,
      creator: {
        ...newVersion.creator,
        fullName: `${newVersion.creator.firstName} ${newVersion.creator.lastName}`,
      },
      previousVersion: newVersion.previousVersion ? {
        ...newVersion.previousVersion,
        creator: {
          ...newVersion.previousVersion.creator,
          fullName: `${newVersion.previousVersion.creator.firstName} ${newVersion.previousVersion.creator.lastName}`,
        },
      } : null,
      fileSizeFormatted: formatFileSize(newVersion.fileSize),
      createdAt: newVersion.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating document version:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create document version' },
      { status: 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}