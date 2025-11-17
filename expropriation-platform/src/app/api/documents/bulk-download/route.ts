import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Writable } from 'stream';
import { DocumentActionType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schema
const bulkDownloadSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'At least one document ID is required'),
  format: z.enum(['zip', 'pdf']).default('zip'),
  includeMetadata: z.boolean().default(true),
  sortBy: z.enum(['title', 'createdAt', 'fileSize', 'documentType']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  createFolders: z.boolean().default(true), // Create folders based on document type/category
  filename: z.string().optional(), // Custom filename for the download package
});

// POST /api/documents/bulk-download - Download multiple documents
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = bulkDownloadSchema.parse(body);

    const {
      documentIds,
      format,
      includeMetadata,
      sortBy,
      sortOrder,
      createFolders,
      filename,
    } = validatedData;

    // Get documents with permission check
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
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

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents found' }, { status: 404 });
    }

    // Check permissions for each document
    const accessibleDocuments = documents.filter(doc => {
      return (
        doc.uploadedById === session.user.id ||
        doc.isPublic ||
        doc.permissions.some(p => p.canDownload)
      );
    });

    if (accessibleDocuments.length === 0) {
      return NextResponse.json({ error: 'No accessible documents found' }, { status: 403 });
    }

    // Check if any files are missing
    const missingFiles = [];
    for (const doc of accessibleDocuments) {
      try {
        const filePath = path.join(process.cwd(), doc.filePath);
        await fs.access(filePath);
      } catch {
        missingFiles.push(doc.originalFileName);
      }
    }

    if (missingFiles.length > 0) {
      return NextResponse.json({
        error: 'Some files are missing',
        missingFiles,
      }, { status: 404 });
    }

    // Sort documents
    const sortedDocuments = [...accessibleDocuments].sort((a, b) => {
      let aValue: any = a[sortBy as keyof typeof a];
      let bValue: any = b[sortBy as keyof typeof b];

      if (sortBy === 'uploadedBy') {
        aValue = `${a.uploadedBy.firstName} ${a.uploadedBy.lastName}`;
        bValue = `${b.uploadedBy.firstName} ${b.uploadedBy.lastName}`;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Generate download filename
    const downloadFilename = filename || `documents_${new Date().toISOString().split('T')[0]}.${format}`;

    // Log bulk download action
    await prisma.documentAction.create({
      data: {
        documentId: sortedDocuments[0].id, // Use first document as reference
        action: DocumentActionType.DOWNLOADED,
        userId: session.user.id,
        metadata: {
          bulkDownload: true,
          documentCount: sortedDocuments.length,
          format,
          includeMetadata,
          documentIds: sortedDocuments.map(doc => doc.id),
        },
      },
    });

    // Create history entries for each document
    for (const doc of sortedDocuments) {
      await prisma.documentHistory.create({
        data: {
          documentId: doc.id,
          action: DocumentActionType.DOWNLOADED,
          description: `Document included in bulk download: ${downloadFilename}`,
          userId: session.user.id,
          fileSize: doc.fileSize,
          fileName: doc.originalFileName,
          filePath: doc.filePath,
          metadata: {
            bulkDownload: true,
            downloadFilename,
            totalDocuments: sortedDocuments.length,
          },
        },
      });
    }

    // Generate the download package
    if (format === 'zip') {
      return await createZipDownload(sortedDocuments, downloadFilename, includeMetadata, createFolders, session.user.id);
    } else if (format === 'pdf') {
      return await createPdfDownload(sortedDocuments, downloadFilename, includeMetadata, session.user.id);
    } else {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Error creating bulk download:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create bulk download' },
      { status: 500 }
    );
  }
}

// Create ZIP download
async function createZipDownload(
  documents: any[],
  filename: string,
  includeMetadata: boolean,
  createFolders: boolean,
  userId: string
) {
  return new Promise<Response>((resolve, reject) => {
    try {
      // Create a transform stream for the ZIP
      const passThrough = new Writable({
        write(chunk, encoding, callback) {
          // This will be handled by the Response
          callback();
        },
      });

      // Create archiver instance
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      // Archive error handling
      archive.on('error', (err) => {
        reject(err);
      });

      // Create response headers
      const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      });

      // Collect archive data
      let chunks: Buffer[] = [];
      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const zipBuffer = Buffer.concat(chunks);
        resolve(new NextResponse(zipBuffer, { headers }));
      });

      // Add files to archive
      const addFilesToArchive = async () => {
        try {
          // Add metadata file if requested
          if (includeMetadata) {
            const metadata = generateMetadata(documents, userId);
            archive.append(JSON.stringify(metadata, null, 2), {
              name: 'metadata.json',
            });
          }

          // Add documents
          for (const doc of documents) {
            const filePath = path.join(process.cwd(), doc.filePath);
            const fileBuffer = await fs.readFile(filePath);

            // Determine folder structure
            let archivePath = doc.originalFileName;

            if (createFolders) {
              const folder = getDocumentFolder(doc);
              archivePath = `${folder}/${doc.originalFileName}`;
            }

            archive.append(fileBuffer, { name: archivePath });

            // Add document-specific metadata if requested
            if (includeMetadata) {
              const docMetadata = generateDocumentMetadata(doc);
              const metadataFilename = archivePath.replace(/\.[^/.]+$/, '') + '_metadata.json';
              archive.append(JSON.stringify(docMetadata, null, 2), {
                name: metadataFilename,
              });
            }
          }

          // Finalize the archive
          archive.finalize();
        } catch (error) {
          archive.emit('error', error);
        }
      };

      addFilesToArchive();
    } catch (error) {
      reject(error);
    }
  });
}

// Create PDF download (placeholder implementation)
async function createPdfDownload(
  documents: any[],
  filename: string,
  includeMetadata: boolean,
  userId: string
): Promise<Response> {
  // This is a placeholder implementation
  // In a real implementation, you would use a PDF library like PDFKit or puppeteer
  // to combine documents into a single PDF or create a PDF with document links

  const pdfInfo = {
    message: 'PDF bulk download requires additional PDF processing library',
    documents: documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.originalFileName,
      fileSize: doc.fileSize,
      documentType: doc.documentType,
    })),
    downloadCount: documents.length,
    generatedBy: userId,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(pdfInfo, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename.replace('.pdf', '.json')}"`,
    },
  });
}

// Helper functions

function getDocumentFolder(doc: any): string {
  if (doc.case) {
    return `cases/${doc.case.fileNumber}`;
  }

  const typeFolders: { [key: string]: string } = {
    LEGAL_DOCUMENT: 'legal',
    TECHNICAL_REPORT: 'technical',
    FINANCIAL_RECORD: 'financial',
    PROPERTY_DOCUMENT: 'property',
    IDENTIFICATION_DOCUMENT: 'identification',
    NOTIFICATION_DOCUMENT: 'notifications',
    CONTRACT_DOCUMENT: 'contracts',
    PHOTOGRAPH: 'images',
    VIDEO: 'videos',
    AUDIO: 'audio',
    SPREADSHEET: 'spreadsheets',
    PRESENTATION: 'presentations',
    OTHER: 'other',
  };

  return typeFolders[doc.documentType] || 'other';
}

function generateMetadata(documents: any[], userId: string): any {
  const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
  const fileTypes = new Set(documents.map(doc => doc.documentType));
  const categories = new Set(documents.map(doc => doc.category));

  return {
    downloadInfo: {
      filename: `documents_${new Date().toISOString().split('T')[0]}.zip`,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      documentCount: documents.length,
      totalSize: totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      fileTypes: Array.from(fileTypes),
      categories: Array.from(categories),
    },
    documents: documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileName: doc.originalFileName,
      fileSize: doc.fileSize,
      fileSizeFormatted: formatFileSize(doc.fileSize),
      mimeType: doc.mimeType,
      documentType: doc.documentType,
      category: doc.category,
      status: doc.status,
      securityLevel: doc.securityLevel,
      version: doc.version,
      uploadedBy: {
        id: doc.uploadedBy.id,
        fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
        email: doc.uploadedBy.email,
      },
      uploadedAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      ...(doc.case && {
        case: {
          id: doc.case.id,
          fileNumber: doc.case.fileNumber,
          title: doc.case.title,
        },
      }),
      tags: doc.tags || [],
    })),
  };
}

function generateDocumentMetadata(doc: any): any {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    fileName: doc.originalFileName,
    fileSize: doc.fileSize,
    fileSizeFormatted: formatFileSize(doc.fileSize),
    mimeType: doc.mimeType,
    documentType: doc.documentType,
    category: doc.category,
    status: doc.status,
    securityLevel: doc.securityLevel,
    version: doc.version,
    isLatest: doc.isLatest,
    isPublic: doc.isPublic,
    downloadCount: doc.downloadCount,
    viewCount: doc.viewCount,
    tags: doc.tags || '',
    metadata: doc.metadata || {},
    customFields: doc.customFields || {},
    retentionPeriod: doc.retentionPeriod,
    expiresAt: doc.expiresAt?.toISOString(),
    uploadedBy: {
      id: doc.uploadedBy.id,
      fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
      email: doc.uploadedBy.email,
    },
    uploadedAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    lastAccessedAt: doc.lastAccessedAt?.toISOString(),
    ...(doc.case && {
      case: {
        id: doc.case.id,
        fileNumber: doc.case.fileNumber,
        title: doc.case.title,
      },
    }),
    stats: {
      versions: doc._count?.versions || 0,
      signatures: doc._count?.signatures || 0,
      history: doc._count?.history || 0,
      actions: doc._count?.actions || 0,
    },
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}