import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Readable } from 'stream';
import archiver from 'archiver';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

type DocumentInfo = {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  caseId?: string | null;
  securityLevel?: string | null;
  uploadedById?: string | null;
  originalFileName?: string | null;
  documentId?: string | null;
  createdBy?: string | null;
  document?: {
    securityLevel: string;
    caseId: string | null;
  };
};

// GET /api/cases/[id]/documents/[documentId] - Unified document endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, documentId } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version'); // Optional version parameter
    const action = searchParams.get('action') || 'preview'; // preview or download
    const format = searchParams.get('format') || 'original'; // original, pdf, zip

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
      getDocumentInfo(documentId, version),
    ]);

    if (!case_ && !document) {
      return NextResponse.json({ error: 'Case and document not found' }, { status: 404 });
    } else if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    } else if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Extract document metadata
    const { caseId: docCaseId, securityLevel, uploadedById, fileName: originalFileName } = extractDocumentMetadata(document, version);

    // Verify case ownership
    if (docCaseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      uploadedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!hasAccess && securityLevel !== 'PUBLIC') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if file exists
    const filePath = path.join(process.cwd(), document.filePath);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let fileBuffer = await fs.readFile(filePath);
    let mimeType = document.mimeType;
    let fileName = originalFileName;

    // Handle format conversion for downloads
    if (action === 'download' && format !== 'original') {
      try {
        const convertedData = await convertDocumentFormat(fileBuffer, document.mimeType, format);
        fileBuffer = Buffer.from(convertedData.buffer);
        mimeType = convertedData.mimeType;
        fileName = `${path.parse(originalFileName).name}.${format}`;
      } catch (error) {
        logger.error('Format conversion error:', error);
        // Fall back to original format if conversion fails
      }
    }

    // Generate download token for downloads
    const downloadToken = action === 'download' ? crypto.randomBytes(32).toString('hex') : undefined;

    // Log access
    await prisma.documentHistory.create({
      data: {
        documentId,
        action: action === 'download' ? 'DOWNLOADED' : 'VIEWED',
        description: `Document ${action === 'download' ? 'downloaded' : 'previewed'}${version ? ` (version ${version})` : ''}${action === 'download' ? ` in ${format} format` : ''}`,
        userId: session.user.id,
        fileSize: action === 'download' ? fileBuffer.length : null,
        fileName: action === 'download' ? fileName : null,
        metadata: {
          [`${action}Timestamp`]: new Date().toISOString(),
          version: version || null,
          ...(action === 'download' && { format, downloadToken }),
          userAgent: request.headers.get('user-agent'),
          ...(action === 'download' && { ipAddress: request.headers.get('x-forwarded-for') }),
        },
      },
    });

    // Update download count for main document
    if (action === 'download' && !version) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      });
    }

    // Handle preview vs download response
    if (action === 'preview') {
      const isPreviewable = [
        'application/pdf',
        'text/plain',
        'text/html',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ].includes(mimeType);

      if (isPreviewable) {
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${document.fileName}"`,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } else {
        return NextResponse.json({
          id: document.id,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          isPreviewable: false,
          message: 'This file type cannot be previewed directly. Please download to view.',
        });
      }
    } else {
      // Download action
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...(downloadToken && { 'X-Download-Token': downloadToken }),
        },
      });
    }
  } catch (error) {
    logger.error(`Error in unified document route:`, error);
    return NextResponse.json(
      { error: 'Failed to process document request' },
      { status: 500 }
    );
  }
}

// Convert document to different formats
async function convertDocumentFormat(
  buffer: Buffer,
  originalMimeType: string,
  targetFormat: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  switch (targetFormat) {
    case 'pdf':
      if (originalMimeType === 'application/pdf') {
        return { buffer, mimeType: 'application/pdf' };
      }
      throw new Error('PDF conversion not implemented');

    case 'zip':
      return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on('data', (chunk: Buffer) => chunks.push(chunk));
        archive.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          resolve({ buffer: zipBuffer, mimeType: 'application/zip' });
        });
        archive.on('error', reject);

        archive.append(buffer, { name: 'document' });
        archive.finalize();
      })

    default:
      throw new Error(`Format ${targetFormat} not supported`);
  }
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
  const permissions = user.role?.permissions as any;
  const hasAdminAccess = permissions?.admin ||
                        permissions?.allDepartments ||
                        permissions?.viewAllCases;

  return sameDepartment || hasAdminAccess;
}

async function getDocumentInfo(documentId: string, version?: string | null): Promise<DocumentInfo | null> {
  if (version) {
    return prisma.documentVersion.findUnique({
      where: {
        documentId_version: { documentId, version: parseInt(version) }
      },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        fileSize: true,
        documentId: true,
        createdBy: true,
        document: {
          select: {
            securityLevel: true,
            caseId: true,
          },
        },
      },
    });
  } else {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        originalFileName: true,
        filePath: true,
        mimeType: true,
        fileSize: true,
        caseId: true,
        uploadedById: true,
        securityLevel: true,
      },
    });

    if (doc) {
      return {
        ...doc,
        document: undefined as any,
      };
    }
    return null;
  }
}

function extractDocumentMetadata(document: DocumentInfo, version?: string | null) {
  const caseId = version ? document.document?.caseId : document.caseId;
  const securityLevel = version ? document.document?.securityLevel : document.securityLevel;
  const uploadedById = version ? undefined : document.uploadedById;
  const fileName = document.originalFileName || document.fileName;

  return {
    caseId: caseId || '',
    securityLevel: securityLevel || '',
    uploadedById,
    fileName,
  };
}