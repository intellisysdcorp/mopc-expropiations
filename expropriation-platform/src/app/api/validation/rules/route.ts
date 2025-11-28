import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ValidationRuleType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

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

    const validationCreatePayload: Prisma.ValidationRuleCreateInput = {
      name: body.name,
      description: body.description,
      type: body.type,
      stage: body.stage,
      expression: body.expression,
      errorMessage: body.errorMessage,
      severity: body.severity,
      dependsOn: body.dependsOn,
    }

    const rule = await prisma.validationRule.create({
      data: validationCreatePayload,
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
          ruleType: body.type,
          severity: body.severity,
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    logger.error('Error creating validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to create validation rule' },
      { status: 500 }
    );
  }
}