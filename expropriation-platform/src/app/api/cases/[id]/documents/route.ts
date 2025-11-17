import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentFormData } from '@/types/client';
import { logger } from '@/lib/logger';
import { createDocumentWithFile } from '@/lib/documents';

// Validation schemas
const createCaseDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  documentType: z.enum([
    'LEGAL', 'EVIDENCE', 'REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'PLAN', 'PERMIT',
    'APPRAISAL', 'CONTRACT', 'CORRESPONDENCE', 'FINANCIAL', 'TECHNICAL', 'OTHER'
  ]),
  category: z.enum([
    'LEGAL', 'TECHNICAL', 'FINANCIAL', 'ADMINISTRATIVE', 'COMMUNICATION',
    'PHOTOGRAPHIC', 'MULTIMEDIA', 'TEMPLATE', 'REFERENCE', 'CORRESPONDENCE'
  ]),
  securityLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).default('INTERNAL'),
  tags: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  retentionPeriod: z.number().optional(),
  expiresAt: z.string().datetime().optional(),
  stageSpecific: z.boolean().default(false),
  applicableStages: z.array(z.string()).optional(),
});

// GET /api/cases/[id]/documents - List documents for a specific case
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);

    // Verify case exists and user has access
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        departmentId: true,
        createdById: true,
        assignedToId: true,
        supervisedById: true,
      },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const documentType = searchParams.get('documentType') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const securityLevel = searchParams.get('securityLevel') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {
      caseId,
      status: { not: 'ARCHIVED' } // Exclude archived (soft deleted) documents
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
        { contentText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (documentType) where.documentType = documentType;
    if (category) where.category = category;
    if (status) where.status = status;
    if (securityLevel) where.securityLevel = securityLevel;

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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Format documents
    const formattedDocuments = documents.map(doc => ({
      ...doc,
      uploadedBy: {
        ...doc.uploadedBy,
        fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
      },
      tags: doc.tagsRelations.map(tag => ({
        id: tag.id,
        tag: tag.tag,
        color: tag.color,
      })),
      fileSizeFormatted: formatFileSize(doc.fileSize),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }));

    // Get document statistics for the case (excluding archived documents)
    const stats = await prisma.document.groupBy({
      by: ['documentType', 'category', 'status'],
      where: {
        caseId,
        status: { not: 'ARCHIVED' } // Exclude archived documents from stats
      },
      _count: true,
    });

    return NextResponse.json({
      documents: formattedDocuments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    logger.error('Error fetching case documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/documents - Upload document to specific case
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Verify case exists and user has access
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        departmentId: true,
        currentStage: true,
        createdById: true,
        assignedToId: true,
        supervisedById: true,
      },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check upload permissions
    const canUpload =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!canUpload) {
      return NextResponse.json({ error: 'Upload permission denied' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawDocumentData = JSON.parse(formData.get('documentData') as string);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate document data
    const validatedData = createCaseDocumentSchema.parse(rawDocumentData);

    // Build document data object to handle exactOptionalPropertyTypes
    const documentData: Partial<DocumentFormData> = {
      title: validatedData.title,
      documentType: validatedData.documentType,
      category: validatedData.category,
      securityLevel: validatedData.securityLevel,
      caseId,
    };

    // Only include optional fields if they exist
    if (validatedData.description !== undefined) {
      documentData.description = validatedData.description;
    }
    if (validatedData.tags !== undefined) {
      documentData.tags = validatedData.tags;
    }
    if (validatedData.retentionPeriod !== undefined) {
      documentData.retentionPeriod = validatedData.retentionPeriod;
    }
    if (validatedData.expiresAt !== undefined) {
      documentData.expiresAt = validatedData.expiresAt;
    }

    // Handle metadata
    const baseMetadata = validatedData.metadata || {};
    documentData.metadata = {
      ...baseMetadata,
      uploadedAtStage: case_.currentStage,
      caseFileNumber: (await prisma.case.findUnique({
        where: { id: caseId },
        select: { fileNumber: true }
      }))?.fileNumber,
    };

    // Handle custom fields
    if (validatedData.customFields !== undefined) {
      documentData.customFields = validatedData.customFields;
    }

    // Create document with case association
    const document = await createDocumentWithFile({
      file,
      documentData,
      userId: session.user.id,
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'UPLOADED',
        entityType: 'document',
        entityId: document.id,
        description: `Document uploaded to case: ${document.title}`,
        userId: session.user.id,
        caseId,
        metadata: {
          documentId: document.id,
          documentTitle: document.title,
          documentType: document.documentType,
          fileName: document.fileName,
        },
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    logger.error('Error uploading case document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// Helper functions
async function hasDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      role: {
        select: { name: true }
      }
    },
  });

  if (!user) return false;

  // Check if user is in the same department or has admin permissions
  const sameDepartment = user.departmentId === departmentId;
  const hasAdminAccess = user.role?.name === 'super_admin' ||
                        user.role?.name === 'department_admin';

  return sameDepartment || hasAdminAccess;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}