import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@/prisma/client';
import { logger } from '@/lib/logger';

const updateChecklistTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  defaultItems: z.array(z.object({
    text: z.string(),
    type: z.enum(['checkbox', 'text', 'date', 'number']),
    required: z.boolean().default(false),
    sequence: z.number().positive(),
  })).optional(),
  autoGenerate: z.boolean().optional(),
});

type UpdateChecklistTemplateData = z.infer<typeof updateChecklistTemplateSchema>;

/**
 * Creates an update data object by filtering out undefined values from validated data.
 * This handles exactOptionalPropertyTypes by only including defined fields.
 */
function createUpdateData(validatedData: UpdateChecklistTemplateData): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (validatedData.name !== undefined) updateData.name = validatedData.name;
  if (validatedData.description !== undefined) updateData.description = validatedData.description;
  if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
  if (validatedData.defaultItems !== undefined) updateData.defaultItems = validatedData.defaultItems;
  if (validatedData.autoGenerate !== undefined) updateData.autoGenerate = validatedData.autoGenerate;

  return updateData;
}

// GET /api/checklist/templates/[id] - Get specific template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.checklistTemplate.findUnique({
      where: { id: (await params).id },
      include: {
        checklistItems: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Checklist template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    logger.error('Error fetching checklist template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist template' },
      { status: 500 }
    );
  }
}

// PUT /api/checklist/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateChecklistTemplateSchema.parse(body);

    // Check if template exists
    const existingTemplate = await prisma.checklistTemplate.findUnique({
      where: { id: (await params).id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Checklist template not found' },
        { status: 404 }
      );
    }

    // Filter out undefined values to handle exactOptionalPropertyTypes
    const updateData = createUpdateData(validatedData);

    const template = await prisma.checklistTemplate.update({
      where: { id: (await params).id },
      data: updateData,
      include: {
        checklistItems: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.UPDATED,
        entityType: 'checklist_template',
        entityId: template.id,
        description: `Updated checklist template: ${template.name}`,
        userId: session.user.id,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating checklist template:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist template' },
      { status: 500 }
    );
  }
}

// DELETE /api/checklist/templates/[id] - Delete template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await prisma.checklistTemplate.findUnique({
      where: { id: (await params).id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Checklist template not found' },
        { status: 404 }
      );
    }

    await prisma.checklistTemplate.delete({
      where: { id: (await params).id },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.DELETED,
        entityType: 'checklist_template',
        entityId: (await params).id,
        description: `Deleted checklist template: ${template.name}`,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      { message: 'Checklist template deleted successfully' }
    );
  } catch (error) {
    logger.error('Error deleting checklist template:', error);
    return NextResponse.json(
      { error: 'Failed to delete checklist template' },
      { status: 500 }
    );
  }
}