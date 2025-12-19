import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// GET /api/templates/[id]/preview - Preview template with variables
export async function GET(
  request: NextRequest,
  { params }: URLParams
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
      (template.allowedRoles && Array.isArray(template.allowedRoles) && template.allowedRoles.length > 0) === false;

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
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          String(value ?? '')
        );
      }
    }

    // Return preview data
    return NextResponse.json({
      templateId: id,
      templateName: template.name,
      templateDescription: template.description || '',
      originalContent: template.content,
      processedContent,
      variables,
      placeholders: template.placeholders,
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