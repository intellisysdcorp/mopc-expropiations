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
  UserRole,
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
  documentType: z.enum(Object.values(DocumentType) as [DocumentType, ...DocumentType[]]),
  category: z.enum(Object.values(DocumentCategory) as [DocumentCategory, ...DocumentCategory[]]),
  securityLevel: z
    .enum(Object.values(DocumentSecurityLevel) as [DocumentSecurityLevel, ...DocumentSecurityLevel[]])
    .default(DocumentSecurityLevel.INTERNAL),
  caseId: z.string().optional(),
  tags: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  retentionPeriod: z.number().optional(),
  expiresAt: z.coerce.date().optional(),
});

const queryDocumentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  documentType: z.enum(Object.values(DocumentType) as [DocumentType, ...DocumentType[]]).optional(),
  category: z.enum(Object.values(DocumentCategory) as [DocumentCategory, ...DocumentCategory[]]).optional(),
  status: z.enum(Object.values(DocumentStatus) as [DocumentStatus, ...DocumentStatus[]]).optional(),
  securityLevel: z.enum(Object.values(DocumentSecurityLevel) as [DocumentSecurityLevel, ...DocumentSecurityLevel[]]).optional(),
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
  } catch (error: unknown) {
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

    // Map role name to UserRole enum
    const roleMap: Record<string, UserRole> = {
      'super_admin': UserRole.SUPER_ADMIN,
      'department_admin': UserRole.DEPARTMENT_ADMIN,
      'analyst': UserRole.ANALYST,
      'supervisor': UserRole.SUPERVISOR,
      'technical_meeting_coordinator': UserRole.TECHNICAL_MEETING_COORDINATOR,
      'observer': UserRole.OBSERVER,
    };

    const userRole = roleMap[user?.role?.name || 'observer'] || UserRole.OBSERVER;

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
      if (file.type === 'text/plain' && uploadResult.filePath) {
        const fileBuffer = await fs.readFile(uploadResult.filePath);
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
        metadata: (validatedData.metadata || {}) as any,
        customFields: (validatedData.customFields || {}) as any,
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
          securityValidation: uploadResult.validation,
          securityLevel: uploadResult.validation.securityLevel,
        } as any,
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
    const documentWithIncludes = document as any;
    const response = {
      id: document.id,
      title: document.title,
      description: document.description,
      fileName: document.fileName,
      originalFileName: document.originalFileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      documentType: document.documentType,
      category: document.category,
      status: document.status,
      securityLevel: document.securityLevel,
      version: document.version,
      isLatest: document.isLatest,
      isDraft: document.isDraft,
      caseId: document.caseId,
      tags: document.tags,
      metadata: document.metadata,
      customFields: document.customFields,
      retentionPeriod: document.retentionPeriod,
      expiresAt: document.expiresAt,
      contentText: document.contentText,
      isIndexed: document.isIndexed,
      indexedAt: document.indexedAt,
      uploadedBy: documentWithIncludes.uploadedBy ? {
        id: documentWithIncludes.uploadedBy.id,
        firstName: documentWithIncludes.uploadedBy.firstName,
        lastName: documentWithIncludes.uploadedBy.lastName,
        email: documentWithIncludes.uploadedBy.email,
        fullName: `${documentWithIncludes.uploadedBy.firstName} ${documentWithIncludes.uploadedBy.lastName}`,
      } : null,
      case: documentWithIncludes.case,
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
  } catch (error: unknown) {
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
