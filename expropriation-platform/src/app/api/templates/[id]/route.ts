import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentSecurityLevel } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  variables: z.record(z.any()).optional(),
  placeholders: z.record(z.any()).optional(),
  layout: z.record(z.any()).optional(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).optional(),
  allowedRoles: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const createVersionSchema = z.object({
  content: z.string().min(1, 'Template content is required'),
  changeLog: z.string().optional(),
  isMajorVersion: z.boolean().default(false),
});

const useTemplateSchema = z.object({
  title: z.string().min(1),
  variables: z.record(z.any()).optional(),
  caseId: z.string().optional(),
  documentType: z.string().optional(),
  category: z.string().optional(),
  securityLevel: z.nativeEnum(DocumentSecurityLevel).optional(),
});

// GET /api/templates/[id] - Get a specific template
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

    // Get template with full details
    const template = await prisma.documentTemplate.findUnique({
      where: { id },
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
        documents: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            documents: true,
            versions: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if user has access to this template
    const hasAccess =
      template.isActive &&
      (template.createdBy === session.user.id ||
        template.isDefault ||
        !template.allowedRoles.length);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Format response
    const response = {
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
      documents: template.documents.map(doc => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      })),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      lastUsedAt: template.lastUsedAt?.toISOString(),
      approvedAt: template.approvedAt?.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    // Check if template exists and user has permission
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existingTemplate.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if new name conflicts with existing template
    if (validatedData.name && validatedData.name !== existingTemplate.name) {
      const conflictingTemplate = await prisma.documentTemplate.findFirst({
        where: {
          name: validatedData.name,
          id: { not: id },
        },
      });

      if (conflictingTemplate) {
        return NextResponse.json(
          { error: 'Template with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update template
    const template = await prisma.documentTemplate.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        content: validatedData.content,
        variables: validatedData.variables,
        placeholders: validatedData.placeholders,
        layout: validatedData.layout,
        securityLevel: validatedData.securityLevel,
        allowedRoles: validatedData.allowedRoles,
        requiredFields: validatedData.requiredFields,
        requiresApproval: validatedData.requiresApproval,
        isActive: validatedData.isActive,
        updatedAt: new Date(),
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

    // Create new version if content changed
    if (validatedData.content && validatedData.content !== existingTemplate.content) {
      const newVersionNumber = existingTemplate.version + 1;

      await prisma.documentTemplateVersion.create({
        data: {
          templateId: id,
          version: newVersionNumber,
          content: validatedData.content,
          changeLog: 'Template updated',
          createdBy: session.user.id,
        },
      });

      // Update template version
      await prisma.documentTemplate.update({
        where: { id },
        data: { version: newVersionNumber },
      });
    }

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

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error updating template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if template exists and user has permission
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existingTemplate.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Don't allow deletion if template is in use
    if (existingTemplate._count.documents > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template that is in use' },
        { status: 409 }
      );
    }

    // Soft delete by marking as inactive
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

// POST /api/templates/[id]/versions - Create new template version
export async function POST_VERSION(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = createVersionSchema.parse(body);

    // Check if template exists and user has permission
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existingTemplate.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get last version number
    const lastVersion = await prisma.documentTemplateVersion.findFirst({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = validatedData.isMajorVersion
      ? Math.floor((lastVersion?.version || 0) / 10) * 10 + 10
      : (lastVersion?.version || 0) + 1;

    // Create new version
    const newVersion = await prisma.documentTemplateVersion.create({
      data: {
        templateId: id,
        version: newVersionNumber,
        content: validatedData.content,
        changeLog: validatedData.changeLog || 'New version created',
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update template
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        version: newVersionNumber,
        content: validatedData.content,
        updatedAt: new Date(),
      },
    });

    // Format response
    const response = {
      ...newVersion,
      creator: {
        ...newVersion.creator,
        fullName: `${newVersion.creator.firstName} ${newVersion.creator.lastName}`,
      },
      createdAt: newVersion.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating template version:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create template version' },
      { status: 500 }
    );
  }
}

// POST /api/templates/[id]/use - Use template to create document
export async function POST_USE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = useTemplateSchema.parse(body);

    // Check if template exists and is active
    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: 'Template is not active' }, { status: 400 });
    }

    // Check if user has access to this template
    const hasAccess =
      template.createdBy === session.user.id ||
      template.isDefault ||
      !template.allowedRoles.length;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Process template content with variables
    let processedContent = template.content;
    if (validatedData.variables) {
      for (const [key, value] of Object.entries(validatedData.variables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(
          new RegExp(placeholder, 'g'),
          String(value)
        );
      }
    }

    // Update template usage statistics
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // Return processed template data
    return NextResponse.json({
      templateId: id,
      templateName: template.name,
      processedContent,
      variables: validatedData.variables,
      documentData: {
        title: validatedData.title,
        description: `Document created from template: ${template.name}`,
        templateId: id,
        caseId: validatedData.caseId,
        documentType: validatedData.documentType,
        category: validatedData.category || template.category,
        securityLevel: validatedData.securityLevel || template.securityLevel,
        content: processedContent,
      },
    });
  } catch (error) {
    logger.error('Error using template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to use template' },
      { status: 500 }
    );
  }
}

// GET /api/templates/[id]/preview - Preview template with variables
export async function GET_PREVIEW(
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
    const variablesParam = searchParams.get('variables');

    // Check if template exists and is active
    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: 'Template is not active' }, { status: 400 });
    }

    // Check if user has access to this template
    const hasAccess =
      template.createdBy === session.user.id ||
      template.isDefault ||
      !template.allowedRoles.length;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse variables
    let variables = {};
    if (variablesParam) {
      try {
        variables = JSON.parse(variablesParam);
      } catch {
        return NextResponse.json(
          { error: 'Invalid variables format' },
          { status: 400 }
        );
      }
    }

    // Process template content with variables
    let processedContent = template.content;
    if (Object.keys(variables).length > 0) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(
          new RegExp(placeholder, 'g'),
          String(value)
        );
      }
    }

    // Return preview data
    return NextResponse.json({
      templateId: id,
      templateName: template.name,
      templateDescription: template.description,
      originalContent: template.content,
      processedContent,
      variables,
      placeholders: template.placeholders,
      variables: template.variables,
      requiredFields: template.requiredFields,
    });
  } catch (error) {
    logger.error('Error previewing template:', error);
    return NextResponse.json(
      { error: 'Failed to preview template' },
      { status: 500 }
    );
  }
}