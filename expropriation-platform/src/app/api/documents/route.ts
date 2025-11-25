import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DocumentType,
  DocumentCategory,
  DocumentStatus,
  DocumentSecurityLevel,
} from '@prisma/client';
import {
  secureFileUpload,
  getSecurityHeaders,
} from '@/lib/file-upload-security';
import { edgeLogger } from '@/lib/edge-logger';
import { logger } from '@/lib/logger';
import { AtomicUploadOptions } from '@/lib/atomic-upload';

// Validation schemas
const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  documentType: z.enum(Object.values(DocumentType) as [string, ...string[]]),
  category: z.enum(Object.values(DocumentCategory) as [string, ...string[]]),
  securityLevel: z
    .enum(Object.values(DocumentSecurityLevel) as [string, ...string[]])
    .default(DocumentSecurityLevel.INTERNAL),
  caseId: z.string().optional(),
  tags: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  retentionPeriod: z.number().optional(),
  expiresAt: z.iso.date().optional(),
});

const queryDocumentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  documentType: z
    .enum(Object.values(DocumentType) as [string, ...string[]])
    .optional(),
  category: z
    .enum(Object.values(DocumentCategory) as [string, ...string[]])
    .optional(),
  status: z
    .enum(Object.values(DocumentStatus) as [string, ...string[]])
    .optional(),
  securityLevel: z
    .enum(Object.values(DocumentSecurityLevel) as [string, ...string[]])
    .optional(),
  caseId: z.string().optional(),
  uploadedById: z.string().optional(),
  tags: z.string().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'fileSize', 'downloadCount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// GET /api/documents - List documents with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = queryDocumentsSchema.parse(Object.fromEntries(searchParams));

    // Build where clause
    const where: any = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { fileName: { contains: query.search } },
        { contentText: { contains: query.search } },
      ];
    }

    if (query.documentType) where.documentType = query.documentType;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.securityLevel) where.securityLevel = query.securityLevel;
    if (query.caseId) where.caseId = query.caseId;
    if (query.uploadedById) where.uploadedById = query.uploadedById;
    if (query.tags) {
      where.tags = { contains: query.tags };
    }

    // Date range filtering
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    // Skip deleted/archived documents unless specifically requested
    if (query.status !== 'ARCHIVED') {
      if (where.OR) {
        // If there's already an OR clause, we need to combine it with the archived filter
        where.AND = [{ OR: where.OR }, { status: { not: 'ARCHIVED' } }];
        delete where.OR;
      } else {
        where.status = { not: 'ARCHIVED' };
      }
    }

    // Get total count
    const total = await prisma.document.count({ where });

    // Get documents with pagination
    const documents = await prisma.document.findMany({
      where,
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
        _count: {
          select: {
            versions: true,
            history: true,
            signatures: true,
          },
        },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    // Format documents
    const formattedDocuments = documents.map((doc) => ({
      ...doc,
      uploadedBy: {
        ...doc.uploadedBy,
        fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
      },
      tags: doc.tagsRelations.map((tag) => ({
        id: tag.id,
        tag: tag.tag,
        color: tag.color,
      })),
      fileSizeFormatted: formatFileSize(doc.fileSize),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      documents: formattedDocuments,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/documents - Upload and create a new document
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentData = JSON.parse(formData.get('documentData') as string);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate document data
    const validatedData = createDocumentSchema.parse(documentData);

    // Get user role for security configuration
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: { select: { name: true } } },
    });

    const userRole = user?.role?.name || 'default';

    // Perform secure file upload with comprehensive validation
    const uploadOptions: Partial<AtomicUploadOptions> = {
      userId: session.user.id,
    };

    if (validatedData.caseId) {
      uploadOptions.caseId = validatedData.caseId;
    }

    const uploadResult = await secureFileUpload(
      request,
      file,
      userRole,
      uploadOptions,
      {
        userRole,
      }
    );

    // Handle upload validation failures
    if (!uploadResult.success) {
      const response = NextResponse.json(
        {
          error: uploadResult.error,
          validation: uploadResult.validation,
        },
        { status: 400 }
      );

      // Add security headers to response
      const securityHeaders = getSecurityHeaders(uploadResult.validation);
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Extract text content for indexing (simplified version)
    let contentText = '';
    try {
      if (file.type === 'text/plain') {
        const fileBuffer = await fs.readFile(uploadResult.filePath!);
        contentText = fileBuffer.toString('utf-8');
      }
      // TODO: Add text extraction for PDF, DOCX, etc.
    } catch (error) {
      logger.error('Error extracting text content:', error);
    }

    // Determine actual MIME type from validation
    const actualMimeType =
      uploadResult.validation.validationDetails.mimeValidation
        ?.recommendedMimeType || file.type;

    // Create document record
    const document = await prisma.document.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        fileName: uploadResult.fileName!,
        originalFileName: file.name,
        filePath: path.relative(process.cwd(), uploadResult.filePath!),
        fileSize: file.size,
        mimeType: actualMimeType,
        fileHash:
          uploadResult.validation.validationDetails.malwareScan?.metadata
            ?.fileHash || '',
        documentType: validatedData.documentType as DocumentType,
        category: validatedData.category as DocumentCategory,
        status: DocumentStatus.DRAFT,
        securityLevel: validatedData.securityLevel as DocumentSecurityLevel,
        version: 1,
        isLatest: true,
        isDraft: true,
        caseId: validatedData.caseId || null,
        uploadedById: session.user.id,
        tags: validatedData.tags || null,
        metadata: {
          ...(validatedData.metadata || {}),
          securityValidation: JSON.parse(
            JSON.stringify(uploadResult.validation)
          ),
          uploadWarnings: uploadResult.validation.warnings,
          securityLevel: uploadResult.validation.securityLevel,
          requiresManualReview: uploadResult.validation.requiresManualReview,
        },
        customFields: validatedData.customFields || {},
        retentionPeriod: validatedData.retentionPeriod || null,
        expiresAt: validatedData.expiresAt
          ? new Date(validatedData.expiresAt)
          : null,
        contentText,
        isIndexed: contentText.length > 0,
        indexedAt: contentText.length > 0 ? new Date() : null,
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
    });

    // Create initial document history entry
    await prisma.documentHistory.create({
      data: {
        documentId: document.id,
        action: 'UPLOADED',
        description: `Document uploaded: ${file.name}`,
        userId: session.user.id,
        fileSize: file.size,
        fileName: file.name,
        filePath: document.filePath,
        metadata: {
          originalFileName: file.name,
          mimeType: actualMimeType,
          uploadTimestamp: new Date().toISOString(),
          securityValidation: JSON.parse(
            JSON.stringify(uploadResult.validation)
          ),
          securityLevel: uploadResult.validation.securityLevel,
        },
      },
    });

    // Create tags if provided
    if (validatedData.tags) {
      const tags = validatedData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      for (const tag of tags) {
        await prisma.documentTag.create({
          data: {
            documentId: document.id,
            tag,
          },
        });
      }
    }

    // Log security events if needed
    if (
      uploadResult.validation.securityLevel === 'high' ||
      uploadResult.validation.securityLevel === 'critical'
    ) {
      edgeLogger.security.suspiciousActivity('high_security_level_upload', {
        userId: session.user.id,
        documentId: document.id,
        fileName: file.name,
        securityLevel: uploadResult.validation.securityLevel,
        warnings: uploadResult.validation.warnings,
        requiresManualReview: uploadResult.validation.requiresManualReview,
      });
    }

    // Format response
    const response = {
      ...document,
      uploadedBy: {
        ...document.uploadedBy,
        fullName: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
      },
      fileSizeFormatted: formatFileSize(document.fileSize),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      securityInfo: {
        securityLevel: uploadResult.validation.securityLevel,
        warnings: uploadResult.validation.warnings,
        requiresManualReview: uploadResult.validation.requiresManualReview,
        recommendations: uploadResult.validation.recommendations,
      },
    };

    const jsonResponse = NextResponse.json(response, { status: 201 });

    // Add security headers to response
    const securityHeaders = getSecurityHeaders(uploadResult.validation);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      jsonResponse.headers.set(key, value);
    });

    return jsonResponse;
  } catch (error) {
    logger.error('Error uploading document:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
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
