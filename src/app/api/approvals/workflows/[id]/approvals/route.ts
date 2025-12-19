import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ApprovalStatus } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

const updateApprovalSchema = z.object({
  decision: z.enum(ApprovalStatus),
  comments: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  delegationTo: z.string().optional(),
});

// GET /api/approvals/workflows/[id]/approvals - Get workflow approvals
export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if workflow exists and user has access
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: (await params).id },
      include: {
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

    if (!workflow) {
      return NextResponse.json(
        { error: 'Approval workflow not found' },
        { status: 404 }
      );
    }

    // Check user permissions
    const hasAccess =
      workflow.initiatedBy === session.user.id ||
      workflow.approvals.some(approval => approval.userId === session.user.id);

    if (!hasAccess) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const isAdmin = user?.role.name === 'SUPER_ADMIN' || user?.role.name === 'DEPARTMENT_ADMIN';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json(workflow.approvals);
  } catch (error) {
    logger.error('Error fetching workflow approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow approvals' },
      { status: 500 }
    );
  }
}

// POST /api/approvals/workflows/[id]/approvals - Submit approval decision
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateApprovalSchema.parse(body);
    const id = (await params).id

    // Check if workflow exists and is pending
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
      include: {
        approvals: true,
        case: true,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Approval workflow not found' },
        { status: 404 }
      );
    }

    if (workflow.status !== ApprovalStatus.PENDING) {
      return NextResponse.json(
        { error: 'Workflow is not pending approval' },
        { status: 400 }
      );
    }

    // Find or create user's approval
    let approval = await prisma.approval.findUnique({
      where: {
        workflowId_userId: {
          workflowId: id,
          userId: session.user.id,
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'You are not assigned as an approver for this workflow' },
        { status: 403 }
      );
    }

    // Update approval
    const responseTime = Math.floor(
      (new Date().getTime() - new Date(workflow.createdAt).getTime()) / (1000 * 60 * 60)
    );

    const updateData: any = {
      decision: validatedData.decision,
      reviewedAt: new Date(),
      responseTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
    };

    if (validatedData.comments !== undefined) {
      updateData.comments = validatedData.comments;
    }

    if (validatedData.conditions !== undefined) {
      updateData.conditions = validatedData.conditions;
    }

    if (validatedData.delegationTo !== undefined) {
      updateData.delegationTo = validatedData.delegationTo;
    }

    approval = await prisma.approval.update({
      where: { id: approval.id },
      data: updateData,
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
    });

    // Check if workflow can be completed
    const allApprovals = await prisma.approval.findMany({
      where: { workflowId: (await params).id },
    });

    const approvedCount = allApprovals.filter(a => a.decision === ApprovalStatus.APPROVED).length;
    const rejectedCount = allApprovals.filter(a => a.decision === ApprovalStatus.REJECTED).length;
    const totalApprovals = allApprovals.length;

    let workflowStatus: ApprovalStatus = workflow.status;
    let completedAt = null;
    let completedBy = null;

    if (rejectedCount > 0) {
      // Any rejection rejects the workflow
      workflowStatus = ApprovalStatus.REJECTED;
      completedAt = new Date();
      completedBy = session.user.id;
    } else if (approvedCount >= workflow.requiredApprovals) {
      // Workflow approved when required count reached
      workflowStatus = ApprovalStatus.APPROVED;
      completedAt = new Date();
      completedBy = session.user.id;
    }

    // Update workflow status if changed
    if (workflowStatus !== workflow.status) {
      await prisma.approvalWorkflow.update({
        where: { id },
        data: {
          status: workflowStatus,
          completedAt,
          completedBy,
        },
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.APPROVED,
        entityType: 'approval',
        entityId: approval.id,
        description: `Approval decision: ${validatedData.decision} for workflow: ${workflow.title}`,
        userId: session.user.id,
        caseId: workflow.caseId,
        metadata: {
          workflowId: workflow.id,
          decision: validatedData.decision,
          comments: validatedData.comments,
        },
      },
    });

    return NextResponse.json({
      approval,
      workflowStatus,
      approvedCount,
      requiredApprovals: workflow.requiredApprovals,
      totalApprovals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error submitting approval decision:', error);
    return NextResponse.json(
      { error: 'Failed to submit approval decision' },
      { status: 500 }
    );
  }
}