import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ApprovalStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createWorkflowSchema = z.object({
  caseId: z.string(),
  stage: z.string(),
  workflowType: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  requiredApprovals: z.number().min(1),
  approvalMatrix: z.object({
    levels: z.array(z.object({
      level: z.number(),
      approvers: z.array(z.string()),
      requiredCount: z.number(),
      conditions: z.array(z.string()).optional(),
    })),
    escalationRules: z.array(z.object({
      condition: z.string(),
      action: z.string(),
      timeframe: z.number(),
    })).optional(),
  }).optional(),
  dueDate: z.iso.datetime().optional(),
});


// GET /api/approvals/workflows - Get approval workflows
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const stage = searchParams.get('stage');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId') || session.user.id;

    const where: any = {};

    if (caseId) where.caseId = caseId;
    if (stage) where.stage = stage as any;
    if (status) where.status = status as ApprovalStatus;

    let workflows;

    if (userId === session.user.id) {
      // Get workflows where user is approver or initiator
      workflows = await prisma.approvalWorkflow.findMany({
        where: {
          ...where,
          OR: [
            { initiatedBy: session.user.id },
            { approvals: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          case: {
            select: {
              id: true,
              fileNumber: true,
              title: true,
              currentStage: true,
            },
          },
          initiator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvals: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: { approvalLevel: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Admin view - get all workflows matching criteria
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const isAdmin = user?.role.name === 'SUPER_ADMIN' || user?.role.name === 'DEPARTMENT_ADMIN';

      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      workflows = await prisma.approvalWorkflow.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              fileNumber: true,
              title: true,
              currentStage: true,
            },
          },
          initiator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvals: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: { approvalLevel: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json(workflows);
  } catch (error) {
    logger.error('Error fetching approval workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval workflows' },
      { status: 500 }
    );
  }
}

// POST /api/approvals/workflows - Create approval workflow
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createWorkflowSchema.parse(body);

    // Check if case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: validatedData.caseId },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Create approval workflow
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        caseId: validatedData.caseId,
        stage: validatedData.stage as any,
        workflowType: validatedData.workflowType,
        title: validatedData.title,
        description: validatedData.description,
        requiredApprovals: validatedData.requiredApprovals,
        approvalMatrix: validatedData.approvalMatrix as any,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        initiatedBy: session.user.id,
      },
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Create approval assignments based on approval matrix
    if (validatedData.approvalMatrix?.levels) {
      const approvalData = validatedData.approvalMatrix.levels
        .filter(level => level.approvers.length > 0)
        .map(level => ({
          workflowId: workflow.id,
          userId: level.approvers[0]!, // Safe to use non-null assertion after filter
          approvalLevel: level.level,
          conditions: level.conditions || [],
        }));

      if (approvalData.length > 0) {
        await prisma.approval.createMany({
          data: approvalData,
        });
      }
    }

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.CREATED,
        entityType: 'approval_workflow',
        entityId: workflow.id,
        description: `Created approval workflow: ${workflow.title}`,
        userId: session.user.id,
        caseId: validatedData.caseId,
        metadata: {
          workflowId: workflow.id,
          workflowType: validatedData.workflowType,
          requiredApprovals: validatedData.requiredApprovals,
        },
      },
    });

    // Fetch complete workflow with approvals
    const completeWorkflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflow.id },
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
          },
        },
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvals: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { approvalLevel: 'asc' },
        },
      },
    });

    return NextResponse.json(completeWorkflow, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating approval workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create approval workflow' },
      { status: 500 }
    );
  }
}