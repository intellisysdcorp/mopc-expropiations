import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createChecklistTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  stage: z.string(),
  defaultItems: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    type: z.string(),
    isRequired: z.boolean().default(true),
    sequence: z.number(),
    estimatedTime: z.number().optional(),
    validationRule: z.string().optional(),
    attachmentRequired: z.boolean().default(false),
    attachmentTypes: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional(),
    autoValidate: z.boolean().default(false),
  })).optional(),
  autoGenerate: z.boolean().default(false),
});


// GET /api/checklist/templates - Get checklist templates
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (stage) where.stage = stage;
    if (isActive !== null) where.isActive = isActive === 'true';

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        checklistItems: {
          where: { isActive: true },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    logger.error('Error fetching checklist templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist templates' },
      { status: 500 }
    );
  }
}

// POST /api/checklist/templates - Create checklist template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createChecklistTemplateSchema.parse(body);

    const template = await prisma.checklistTemplate.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        stage: validatedData.stage as any,
        defaultItems: validatedData.defaultItems || [],
        autoGenerate: validatedData.autoGenerate,
      },
      include: {
        checklistItems: true,
      },
    });

    // Create checklist items if provided
    if (validatedData.defaultItems && validatedData.defaultItems.length > 0) {
      await prisma.checklistItem.createMany({
        data: validatedData.defaultItems.map((item, _index) => ({
          templateId: template.id,
          title: item.title,
          description: item.description,
          type: item.type as any,
          isRequired: item.isRequired,
          sequence: item.sequence,
          estimatedTime: item.estimatedTime,
          validationRule: item.validationRule,
          attachmentRequired: item.attachmentRequired,
          attachmentTypes: item.attachmentTypes,
          dependencies: item.dependencies,
          autoValidate: item.autoValidate,
        })),
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.CREATED,
        entityType: 'checklist_template',
        entityId: template.id,
        description: `Created checklist template: ${template.name}`,
        userId: session.user.id,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating checklist template:', error);
    return NextResponse.json(
      { error: 'Failed to create checklist template' },
      { status: 500 }
    );
  }
}