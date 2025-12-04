import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// POST /api/templates/[id]/use - Use template to create document
export async function POST(
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
      (template.allowedRoles && Array.isArray(template.allowedRoles) && template.allowedRoles.length > 0) === false;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Process template content with variables
    let processedContent = template.content;
    if (body.variables) {
      for (const [key, value] of Object.entries(body.variables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          String(value ?? '')
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
      variables: body.variables || {},
      documentData: {
        title: body.title,
        description: `Document created from template: ${template.name}`,
        templateId: id,
        caseId: body.caseId,
        documentType: body.documentType,
        category: body.category || template.category,
        securityLevel: body.securityLevel || template.securityLevel,
        content: processedContent,
      },
    } as any);
  } catch (error) {
    logger.error('Error using template:', error);
    return NextResponse.json(
      { error: 'Failed to use template' },
      { status: 500 }
    );
  }
}