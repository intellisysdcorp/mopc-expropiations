import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// Helper function to add fullName to objects with firstName and lastName
function withFullName<T extends { firstName: string; lastName: string }>(obj: T): T & { fullName: string } {
  return {
    ...obj,
    fullName: `${obj.firstName} ${obj.lastName}`,
  };
}

// GET /api/templates/[id] - Get a specific template
export async function GET(
  _request: NextRequest,
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
        (template.allowedRoles && Array.isArray(template.allowedRoles) && template.allowedRoles.length > 0) === false);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Format response
    const response: any = {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    // Add nullable date fields conditionally
    if (template.lastUsedAt) {
      response.lastUsedAt = template.lastUsedAt.toISOString();
    }
    if (template.approvedAt) {
      response.approvedAt = template.approvedAt.toISOString();
    }
    if (template.creator) {
      response.creator = withFullName(template.creator);
    }
    if (template.versions.length > 0) {
      response.versions = template.versions.map((version) => {
        const hydratedVersion: any = {
          ...version,
          createdAt: version.createdAt.toISOString()
        };
        if (version.creator) hydratedVersion.creator = withFullName(version.creator)
        return hydratedVersion;
      })
    }
    if (template.documents.length > 0) {
      response.documents = template.documents.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt.toISOString()
      }))
    }

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
    if (body.name && body.name !== existingTemplate.name) {
      const conflictingTemplate = await prisma.documentTemplate.findFirst({
        where: {
          name: body.name,
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

    const payload: Prisma.DocumentTemplateUpdateInput = {
      updatedAt: new Date()
    };

    if (body.name) payload.name = body.name;
    if (body.description !== undefined) payload.description = body.description;
    if (body.content) payload.content = body.content;
    if (body.variables) payload.variables = body.variables as Prisma.InputJsonValue;
    if (body.placeholders) payload.placeholders = body.placeholders as Prisma.InputJsonValue;
    if (body.layout) payload.layout = body.layout as Prisma.InputJsonValue;
    if (body.securityLevel) payload.securityLevel = body.securityLevel;
    if (body.allowedRoles) payload.allowedRoles = body.allowedRoles;
    if (body.requiredFields) payload.requiredFields = body.requiredFields as Prisma.InputJsonValue;
    if (body.requiresApproval !== undefined) payload.requiresApproval = body.requiresApproval;
    if (body.isActive !== undefined) payload.isActive = body.isActive;

    // Update template
    const template = await prisma.documentTemplate.update({
      where: { id },
      data: payload,
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
    if (body.content && body.content !== existingTemplate.content) {
      const newVersionNumber = existingTemplate.version + 1;

      await prisma.documentTemplateVersion.create({
        data: {
          templateId: id,
          version: newVersionNumber,
          content: body.content,
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
      creator: withFullName(template.creator),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
  _request: NextRequest,
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

