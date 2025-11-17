import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import archiver from 'archiver';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/cases/[id]/documents/[documentId]/download - Download document
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
      version
        ? prisma.documentVersion.findUnique({
            where: {
              documentId_version: { documentId, version: parseInt(version) }
            },
            select: {
              id: true,
              fileName: true,
              originalFileName: true,
              filePath: true,
              mimeType: true,
              fileSize: true,
              documentId: true,
              createdById: true,
              document: {
                select: {
                  securityLevel: true,
                  caseId: true,
                },
              },
            },
          })
        : prisma.document.findUnique({
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
          }),
    ]);

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify case ownership
    const docCaseId = version ? document.document.caseId : document.caseId;
    if (docCaseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // Get security level
    const securityLevel = version ? document.document.securityLevel : document.securityLevel;

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      document.uploadedById === session.user.id ||
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

    // Get file stats
    const stats = await fs.stat(filePath);
    let fileBuffer = await fs.readFile(filePath);
    let fileName = document.originalFileName || document.fileName;
    let mimeType = document.mimeType;

    // Handle different formats
    if (format !== 'original') {
      try {
        const convertedData = await convertDocumentFormat(fileBuffer, document.mimeType, format);
        fileBuffer = convertedData.buffer;
        mimeType = convertedData.mimeType;
        fileName = `${path.parse(fileName).name}.${format}`;
      } catch (error) {
        logger.error('Format conversion error:', error);
        // Fall back to original format if conversion fails
      }
    }

    // Generate download token for security (optional but recommended)
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store download token (you might want to use Redis for this in production)
    await prisma.documentHistory.create({
      data: {
        documentId,
        action: 'DOWNLOADED',
        description: `Document downloaded${version ? ` (version ${version})` : ''} in ${format} format`,
        userId: session.user.id,
        fileSize: fileBuffer.length,
        fileName: fileName,
        metadata: {
          downloadTimestamp: new Date().toISOString(),
          version: version || null,
          format,
          downloadToken,
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.ip || request.headers.get('x-forwarded-for'),
        },
      },
    });

    // Update download count for main document
    if (!version) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      });
    }

    // Return file as download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Download-Token': downloadToken,
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

// Convert document to different formats (simplified version)
async function convertDocumentFormat(
  buffer: Buffer,
  originalMimeType: string,
  targetFormat: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // This is a placeholder implementation
  // In a real application, you would use libraries like:
  // - pdf-lib for PDF manipulation
  // - sharp for image conversion
  // - libreoffice-headless for document conversion

  switch (targetFormat) {
    case 'pdf':
      if (originalMimeType === 'application/pdf') {
        return { buffer, mimeType: 'application/pdf' };
      }
      // For other formats, you would implement conversion
      throw new Error('PDF conversion not implemented');

    case 'zip':
      // Create a zip file containing the document
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
      });

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
  const hasAdminAccess = user.role?.permissions?.admin ||
                        user.role?.permissions?.allDepartments ||
                        user.role?.permissions?.viewAllCases;

  return sameDepartment || hasAdminAccess;
}