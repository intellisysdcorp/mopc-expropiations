import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ValidationRuleType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(ValidationRuleType),
  stage: z.string().optional(),
  expression: z.string(),
  errorMessage: z.string(),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']).default('ERROR'),
  dependsOn: z.array(z.string()).optional(),
});

// GET /api/validation/rules - Get validation rules
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const stage = searchParams.get('stage');
    const isActive = searchParams.get('isActive');

    const where: any = {};

    if (type) where.type = type as ValidationRuleType;
    if (stage) where.stage = stage;
    if (isActive !== null) where.isActive = isActive === 'true';

    const rules = await prisma.validationRule.findMany({
      where,
      include: {
        executions: {
          select: {
            id: true,
            passed: true,
            executedAt: true,
          },
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rules);
  } catch (error) {
    logger.error('Error fetching validation rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation rules' },
      { status: 500 }
    );
  }
}

// POST /api/validation/rules - Create validation rule
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createRuleSchema.parse(body);

    const rule = await prisma.validationRule.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        stage: validatedData.stage,
        expression: validatedData.expression,
        errorMessage: validatedData.errorMessage,
        severity: validatedData.severity,
        dependsOn: validatedData.dependsOn,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.CREATED,
        entityType: 'validation_rule',
        entityId: rule.id,
        description: `Created validation rule: ${rule.name}`,
        userId: session.user.id,
        metadata: {
          ruleType: validatedData.type,
          severity: validatedData.severity,
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to create validation rule' },
      { status: 500 }
    );
  }
}