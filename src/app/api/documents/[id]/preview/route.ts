import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { DocumentActionType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Supported preview types and their processing
const PREVIEW_CONFIG = {
  // Image formats
  'image/jpeg': { type: 'image', format: 'jpeg' },
  'image/png': { type: 'image', format: 'png' },
  'image/gif': { type: 'image', format: 'gif' },
  'image/webp': { type: 'image', format: 'webp' },
  'image/tiff': { type: 'image', format: 'jpeg' },

  // PDF (would need PDF processing library like pdf-poppler or pdf2pic)
  'application/pdf': { type: 'pdf' },

  // Text formats
  'text/plain': { type: 'text' },
  'text/csv': { type: 'text' },
  'text/html': { type: 'text' },

  // JSON
  'application/json': { type: 'text' },
};

// GET /api/documents/[id]/preview - Generate document preview
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = searchParams.get('size') || 'medium'; // small, medium, large

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

    // Check view permissions
    const canView =
      document.uploadedById === session.user.id ||
      document.isPublic ||
      document.permissions.some(p => p.canView);

    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if preview is supported for this file type
    const previewConfig = PREVIEW_CONFIG[document.mimeType as keyof typeof PREVIEW_CONFIG];
    if (!previewConfig) {
      return NextResponse.json({
        error: 'Preview not supported for this file type',
        supportedTypes: Object.keys(PREVIEW_CONFIG)
      }, { status: 400 });
    }

    // Check if document file exists
    const filePath = path.join(process.cwd(), document.filePath);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Process based on file type
    switch (previewConfig.type) {
      case 'image':
        return await generateImagePreview(filePath, document, size, session.user.id);

      case 'pdf':
        return await generatePdfPreview(filePath, document, page, size, session.user.id);

      case 'text':
        return await generateTextPreview(filePath, document, session.user.id);

      default:
        return NextResponse.json({ error: 'Preview not supported' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}

// Generate image preview with resizing
async function generateImagePreview(
  filePath: string,
  document: any,
  size: string,
  userId: string
) {
  try {
    // Define size configurations
    const sizeConfig = {
      small: { width: 200, height: 200, quality: 70 },
      medium: { width: 600, height: 600, quality: 80 },
      large: { width: 1200, height: 1200, quality: 90 },
    };

    const config = sizeConfig[size as keyof typeof sizeConfig] || sizeConfig.medium;

    // Generate thumbnail if it doesn't exist
    const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });

    const thumbnailPath = path.join(thumbnailDir, `${document.id}_${size}.jpg`);

    try {
      // Check if thumbnail already exists
      await fs.access(thumbnailPath);
    } catch {
      // Generate new thumbnail
      await sharp(filePath)
        .resize(config.width, config.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: config.quality })
        .toFile(thumbnailPath);
    }

    // Read thumbnail
    const thumbnailBuffer = await fs.readFile(thumbnailPath);

    // Log preview action
    await logPreviewAction(document.id, userId, 'image', { size });

    // Return image
    return new NextResponse(thumbnailBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': thumbnailBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    logger.error('Error generating image preview:', error);
    throw error;
  }
}

// Generate PDF preview (placeholder implementation)
async function generatePdfPreview(
  filePath: string,
  document: any,
  page: number,
  size: string,
  userId: string
) {
  try {
    // This is a placeholder implementation
    // In a real implementation, you would use a PDF processing library
    // like pdf-poppler, pdf2pic, or similar

    // For now, return PDF info as JSON
    const pdfInfo = {
      message: 'PDF preview requires additional PDF processing library',
      documentId: document.id,
      fileName: document.originalFileName,
      fileSize: document.fileSize,
      requestedPage: page,
      size,
      mimeType: document.mimeType,
    };

    // Log preview action
    await logPreviewAction(document.id, userId, 'pdf', { page, size });

    return NextResponse.json(pdfInfo);
  } catch (error) {
    logger.error('Error generating PDF preview:', error);
    throw error;
  }
}

// Generate text preview
async function generateTextPreview(
  filePath: string,
  document: any,
  userId: string
) {
  try {
    // Read text file
    const fileBuffer = await fs.readFile(filePath);
    let content = fileBuffer.toString('utf-8');

    // Limit preview content size
    const maxPreviewSize = 10000; // 10KB
    if (content.length > maxPreviewSize) {
      content = content.substring(0, maxPreviewSize) + '\n\n... (content truncated)';
    }

    // Get encoding and line count info
    const lines = content.split('\n');
    const preview = {
      content,
      lines: lines.length,
      size: content.length,
      encoding: 'utf-8',
      mimeType: document.mimeType,
      fileName: document.originalFileName,
    };

    // Log preview action
    await logPreviewAction(document.id, userId, 'text', {
      size: content.length,
      lines: lines.length
    });

    return NextResponse.json(preview, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
      },
    });
  } catch (error) {
    logger.error('Error generating text preview:', error);
    throw error;
  }
}

// Log preview action
async function logPreviewAction(
  documentId: string,
  userId: string,
  type: string,
  metadata: any
) {
  try {
    // Create preview action
    await prisma.documentAction.create({
      data: {
        documentId,
        action: DocumentActionType.VIEWED,
        userId,
        metadata: {
          previewType: type,
          ...metadata,
        },
      },
    });

    // Update last accessed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        lastAccessedAt: new Date(),
        lastAccessedBy: userId,
      },
    });
  } catch (error) {
    logger.error('Error logging preview action:', error);
    // Don't throw here, as it's not critical for the preview functionality
  }
}