import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Get all stages
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true, department: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all stages
    const stages = await prisma.stage.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' },
      include: {
        stageChecklists: {
          where: { isActive: true },
          orderBy: { sequence: 'asc' }
        },
        _count: {
          select: {
            caseStageAssignments: true,
            stageProgressions: true
          }
        }
      }
    });

    return NextResponse.json(stages);

  } catch (error) {
    logger.error('Error fetching stages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new stage (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only super admins can create stages
    if (user.role.name !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      stage,
      name,
      description,
      sequenceOrder,
      responsibleDepartment,
      estimatedDuration,
      requiredDocuments,
      validationRules,
      autoAssignmentRules
    } = body;

    // Create stage
    const newStage = await prisma.stage.create({
      data: {
        stage,
        name,
        description,
        sequenceOrder,
        responsibleDepartment,
        estimatedDuration,
        requiredDocuments,
        validationRules,
        autoAssignmentRules
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'CREATED',
        entityType: 'stage',
        entityId: newStage.id,
        description: `Created stage: ${newStage.name}`,
        metadata: {
          stageId: newStage.id,
          stageName: newStage.name,
          sequenceOrder: newStage.sequenceOrder
        }
      }
    });

    return NextResponse.json({
      success: true,
      stage: newStage
    });

  } catch (error) {
    logger.error('Error creating stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}