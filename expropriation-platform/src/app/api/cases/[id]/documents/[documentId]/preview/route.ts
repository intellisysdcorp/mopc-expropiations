import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/logger';

// GET /api/cases/[id]/documents/[documentId]/preview - Preview document
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
              filePath: true,
              mimeType: true,
              fileSize: true,
              documentId: true,
              createdById: true,
            },
          })
        : prisma.document.findUnique({
            where: { id: documentId },
            select: {
              id: true,
              fileName: true,
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

    // For main document (not version), verify case ownership
    if (!version && document.caseId !== caseId) {
      return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
    }

    // For version, get main document to check security
    let securityLevel = 'INTERNAL';
    if (version) {
      const mainDoc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { securityLevel: true, caseId: true },
      });
      if (mainDoc?.caseId !== caseId) {
        return NextResponse.json({ error: 'Document does not belong to this case' }, { status: 400 });
      }
      securityLevel = mainDoc.securityLevel;
    } else {
      securityLevel = document.securityLevel;
    }

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
    const fileBuffer = await fs.readFile(filePath);

    // Log preview access
    await prisma.documentHistory.create({
      data: {
        documentId,
        action: 'PREVIEWED',
        description: `Document previewed${version ? ` (version ${version})` : ''}`,
        userId: session.user.id,
        metadata: {
          previewTimestamp: new Date().toISOString(),
          version: version || null,
          userAgent: request.headers.get('user-agent'),
        },
      },
    });

    // Update download count if it's the main document
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

    // Determine appropriate content type and handling
    const mimeType = document.mimeType;
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
      // Return file for inline preview
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${document.fileName}"`,
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } else {
      // For non-previewable files, return file info
      return NextResponse.json({
        id: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        isPreviewable: false,
        message: 'This file type cannot be previewed directly. Please download to view.',
      });
    }
  } catch (error) {
    logger.error('Error previewing document:', error);
    return NextResponse.json(
      { error: 'Failed to preview document' },
      { status: 500 }
    );
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