import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { DocumentActionType } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// GET /api/documents/[id]/download - Download a document
export async function GET(
  request: NextRequest,
  { params }: URLParams
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
        permissions: {
          where: {
            OR: [
              { userId: session.user.id },
              { isActive: true },
            ],
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check download permissions
    const canDownload =
      document.uploadedById === session.user.id ||
      document.isPublic ||
      document.permissions.some(p => p.canDownload);

    if (!canDownload) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if document file exists
    const filePath = path.join(process.cwd(), document.filePath);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Increment download count
    await prisma.document.update({
      where: { id },
      data: {
        downloadCount: { increment: 1 },
        lastAccessedAt: new Date(),
        lastAccessedBy: session.user.id,
      },
    });

    // Create download action
    await prisma.documentAction.create({
      data: {
        documentId: id,
        action: DocumentActionType.DOWNLOADED,
        userId: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: {
          fileName: document.originalFileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
        },
      },
    });

    // Create history entry
    await prisma.documentHistory.create({
      data: {
        documentId: id,
        action: DocumentActionType.DOWNLOADED,
        description: `Document downloaded: ${document.originalFileName}`,
        userId: session.user.id,
        fileSize: document.fileSize,
        fileName: document.originalFileName,
        filePath: document.filePath,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.originalFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('Error downloading document:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}