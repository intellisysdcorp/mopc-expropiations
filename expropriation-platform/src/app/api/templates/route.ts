import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { TemplateType, DocumentCategory, DocumentSecurityLevel } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  templateType: z.nativeEnum(TemplateType),
  category: z.nativeEnum(DocumentCategory),
  content: z.string().min(1, 'Template content is required'),
  variables: z.record(z.any()).optional(),
  placeholders: z.record(z.any()).optional(),
  layout: z.record(z.any()).optional(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).default(DocumentSecurityLevel.INTERNAL),
  allowedRoles: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  requiresApproval: z.boolean().default(false),
});

const queryTemplatesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  templateType: z.nativeEnum(TemplateType).optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'usageCount', 'lastUsedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  createdBy: z.string().optional(),
});

// GET /api/templates - List templates with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = queryTemplatesSchema.parse(Object.fromEntries(searchParams));

    // Build where clause
    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.templateType) where.templateType = query.templateType;
    if (query.category) where.category = query.category;
    if (query.securityLevel) where.securityLevel = query.securityLevel;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isDefault !== undefined) where.isDefault = query.isDefault;
    if (query.createdBy) where.createdBy = query.createdBy;

    // Get total count
    const total = await prisma.documentTemplate.count({ where });

    // Get templates with pagination
    const templates = await prisma.documentTemplate.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
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
        _count: {
          select: {
            documents: true,
            versions: true,
          },
        },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    // Format templates
    const formattedTemplates = templates.map(template => ({
      ...template,
      creator: {
        ...template.creator,
        fullName: `${template.creator.firstName} ${template.creator.lastName}`,
      },
      versions: template.versions.map(version => ({
        ...version,
        creator: {
          ...version.creator,
          fullName: `${version.creator.firstName} ${version.creator.lastName}`,
        },
        createdAt: version.createdAt.toISOString(),
      })),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      lastUsedAt: template.lastUsedAt?.toISOString(),
      approvedAt: template.approvedAt?.toISOString(),
    }));

    return NextResponse.json({
      templates: formattedTemplates,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTemplateSchema.parse(body);

    // Check if template name already exists
    const existingTemplate = await prisma.documentTemplate.findFirst({
      where: { name: validatedData.name },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    // Create template
    const template = await prisma.documentTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        templateType: validatedData.templateType,
        category: validatedData.category,
        content: validatedData.content,
        variables: validatedData.variables || {},
        placeholders: validatedData.placeholders || {},
        layout: validatedData.layout || {},
        securityLevel: validatedData.securityLevel,
        allowedRoles: validatedData.allowedRoles || [],
        requiredFields: validatedData.requiredFields || [],
        requiresApproval: validatedData.requiresApproval,
        version: 1,
        isActive: true,
        isDefault: false,
        createdBy: session.user.id,
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
      },
    });

    // Create initial version
    await prisma.documentTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        content: validatedData.content,
        changeLog: 'Initial version',
        createdBy: session.user.id,
      },
    });

    // Format response
    const response = {
      ...template,
      creator: {
        ...template.creator,
        fullName: `${template.creator.firstName} ${template.creator.lastName}`,
      },
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// GET /api/templates/types - Get available template types
export async function GET_TYPES() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateTypes = Object.values(TemplateType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: getTemplateTypeDescription(type),
    }));

    return NextResponse.json({ templateTypes });
  } catch (error) {
    logger.error('Error fetching template types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template types' },
      { status: 500 }
    );
  }
}

// GET /api/templates/categories - Get template categories
export async function GET_CATEGORIES() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = Object.values(DocumentCategory).map(category => ({
      value: category,
      label: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: getCategoryDescription(category),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// Helper functions

function getTemplateTypeDescription(type: TemplateType): string {
  const descriptions: { [key in TemplateType]: string } = {
    LEGAL_TEMPLATE: 'Legal document templates for contracts, agreements, and legal notices',
    FORM_TEMPLATE: 'Form templates for data collection and standardized forms',
    REPORT_TEMPLATE: 'Report templates for analysis, summaries, and presentations',
    LETTER_TEMPLATE: 'Letter templates for correspondence and communication',
    CONTRACT_TEMPLATE: 'Contract templates for agreements and commitments',
    MEMO_TEMPLATE: 'Memo templates for internal communication',
    CERTIFICATE_TEMPLATE: 'Certificate templates for awards and certifications',
    NOTIFICATION_TEMPLATE: 'Notification templates for alerts and announcements',
  };

  return descriptions[type] || 'Template type description';
}

function getCategoryDescription(category: DocumentCategory): string {
  const descriptions: { [key in DocumentCategory]: string } = {
    LEGAL: 'Legal documents and legal correspondence',
    TECHNICAL: 'Technical reports, specifications, and documentation',
    FINANCIAL: 'Financial reports, statements, and records',
    ADMINISTRATIVE: 'Administrative documents and procedures',
    COMMUNICATION: 'Communication documents and correspondence',
    PHOTOGRAPHIC: 'Photographs and visual documentation',
    MULTIMEDIA: 'Audio, video, and multimedia content',
    TEMPLATE: 'Document templates and forms',
    REFERENCE: 'Reference materials and documentation',
    CORRESPONDENCE: 'Letters, emails, and correspondence',
  };

  return descriptions[category] || 'Document category description';
}