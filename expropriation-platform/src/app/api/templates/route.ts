import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TemplateType, DocumentCategory, DocumentSecurityLevel } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// Type for template search parameters
interface TemplateSearchParams {
  search?: string;
  templateType?: TemplateType;
  category?: DocumentCategory;
  securityLevel?: DocumentSecurityLevel;
  isActive?: string;
  isDefault?: string;
  createdBy?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// GET /api/templates - List templates with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query: TemplateSearchParams = Object.fromEntries(searchParams);

    // Parse pagination parameters with defaults
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Format templates
    const formattedTemplates = templates.map((template: any) => {
      // Start with required values
      const formattedTemplate: any = {
        id: template.id,
        name: template.name,
        templateType: template.templateType,
        content: template.content,
        version: template.version,
        isActive: template.isActive,
        isDefault: template.isDefault,
        usageCount: template.usageCount,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
        _count: template._count,
      };

      // Add nullable values conditionally
      if (template.description) {
        formattedTemplate.description = template.description;
      }

      if (template.category) {
        formattedTemplate.category = template.category;
      }

      if (template.lastUsedAt) {
        formattedTemplate.lastUsedAt = template.lastUsedAt.toISOString();
      }

      if (template.approvedAt) {
        formattedTemplate.approvedAt = template.approvedAt.toISOString();
      }

      if (template.approvedBy) {
        formattedTemplate.approvedBy = template.approvedBy;
      }

      if (template.creator) {
        formattedTemplate.creator = {
          ...template.creator,
          fullName: `${template.creator.firstName} ${template.creator.lastName}`,
        };
      }

      if (template.versions) {
        formattedTemplate.versions = template.versions.map((version: any) => {
          // Start with required values
          const formattedVersion: any = {
            id: version.id,
            templateId: version.templateId,
            version: version.version,
            content: version.content,
            changeLog: version.changeLog,
            createdAt: version.createdAt.toISOString(),
            updatedAt: version.updatedAt.toISOString(),
          };

          // Add nullable values conditionally
          if (version.creator) {
            formattedVersion.creator = {
              ...version.creator,
              fullName: `${version.creator.firstName} ${version.creator.lastName}`,
            };
          }

          return formattedVersion;
        });
      }

      return formattedTemplate;
    });

    return NextResponse.json({
      templates: formattedTemplates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
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

    const body: Prisma.DocumentTemplateCreateInput = await request.json();

    // Check if template name already exists
    const existingTemplate = await prisma.documentTemplate.findFirst({
      where: { name: body.name },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    // Create data payload with required fields first
    const dataPayload: Prisma.DocumentTemplateCreateInput = {
      name: body.name,
      templateType: body.templateType,
      category: body.category ?? DocumentCategory.ADMINISTRATIVE,
      content: body.content,
      requiresApproval: body.requiresApproval ?? false,
      version: 1,
      isActive: true,
      isDefault: false,
      creator: body.creator,
      securityLevel: body.securityLevel || DocumentSecurityLevel.INTERNAL
    };

    // Add nullable fields conditionally
    if (body.description !== undefined) {
      dataPayload.description = body.description;
    }

    if (body.variables) {
      dataPayload.variables = body.variables;
    }

    if (body.placeholders) {
      dataPayload.placeholders = body.placeholders;
    }

    if (body.layout) {
      dataPayload.layout = body.layout;
    }

    if (body.allowedRoles) {
      dataPayload.allowedRoles = body.allowedRoles;
    }

    if (body.requiredFields) {
      dataPayload.requiredFields = body.requiredFields;
    }

    // Create template
    const template = await prisma.documentTemplate.create({
      data: dataPayload,
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
        content: body.content,
        changeLog: 'Initial version',
        createdBy: session.user.id,
      },
    });

    // Format response
    const response = {
      ...template,
      creator: (template as any).creator ? {
        ...(template as any).creator,
        fullName: `${(template as any).creator.firstName} ${(template as any).creator.lastName}`,
      } : null,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating template:', error);

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