import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/cases/[id]/validation-summary - Get comprehensive validation summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Get case information
    const caseInfo = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        fileNumber: true,
        title: true,
        currentStage: true,
        estimatedValue: true,
        currency: true,
        createdAt: true,
      },
    });

    if (!caseInfo) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get checklist progress
    const caseStageAssignment = await prisma.caseStageAssignment.findFirst({
      where: {
        caseId,
        stage: caseInfo.currentStage,
        isActive: true,
      },
      include: {
        checklistCompletions: {
          include: {
            item: {
              include: {
                template: true,
              },
            },
          },
        },
      },
    });

    let checklistProgress = 0;
    if (caseStageAssignment) {
      const requiredItems = caseStageAssignment.checklistCompletions.filter(
        cc => cc.item.isRequired
      );
      const completedRequired = requiredItems.filter(cc => cc.isCompleted);
      checklistProgress = requiredItems.length > 0
        ? Math.round((completedRequired.length / requiredItems.length) * 100)
        : 100; // No required items means 100% complete
    }

    // Get approval progress
    const approvalWorkflows = await prisma.approvalWorkflow.findMany({
      where: { caseId },
      include: {
        approvals: true,
      },
    });

    let approvalProgress = 100; // No workflows means 100% complete
    if (approvalWorkflows.length > 0) {
      const completedWorkflows = approvalWorkflows.filter(
        aw => aw.status === 'APPROVED' || aw.status === 'REJECTED'
      );
      approvalProgress = Math.round((completedWorkflows.length / approvalWorkflows.length) * 100);
    }

    // Get review progress
    const reviewAssignments = await prisma.reviewAssignment.findMany({
      where: { caseId },
      include: {
        reviews: true,
      },
    });

    let reviewProgress = 100; // No reviews means 100% complete
    if (reviewAssignments.length > 0) {
      const completedReviews = reviewAssignments.filter(
        ra => ra.status === 'COMPLETED'
      );
      reviewProgress = Math.round((completedReviews.length / reviewAssignments.length) * 100);
    }

    // Get validation execution progress
    const validationExecutions = await prisma.validationExecution.findMany({
      where: { caseId },
      include: {
        rule: true,
      },
      orderBy: { executedAt: 'desc' },
      take: 100, // Last 100 executions
    });

    let validationProgress = 100; // No validations means 100% complete
    if (validationExecutions.length > 0) {
      const passedValidations = validationExecutions.filter(ve => ve.passed);
      validationProgress = Math.round((passedValidations.length / validationExecutions.length) * 100);
    }

    // Get observations count
    const openObservations = await prisma.observation.count({
      where: {
        caseId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'RESPONDED'] },
      },
    });

    // Get pending signatures
    const pendingSignatures = await prisma.digitalSignature.count({
      where: {
        entityType: 'case',
        entityId: caseId,
        isActive: true,
      },
    });

    // Get overdue items
    const now = new Date();
    const overdueTimeEntries = await prisma.timeTracking.count({
      where: {
        caseId,
        endTime: null,
        alertThreshold: {
          not: null,
        },
        startTime: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Older than 24 hours
        },
      },
    });

    const overdueObservations = await prisma.observation.count({
      where: {
        caseId,
        deadline: {
          lt: now,
        },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    });

    const overdueItems = overdueTimeEntries + overdueObservations;

    // Get latest risk assessment
    const latestRiskAssessment = await prisma.riskAssessment.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    const riskScore = latestRiskAssessment?.riskScore || 0;

    // Calculate overall progress (weighted average)
    const overallProgress = Math.round(
      (checklistProgress * 0.3 +
       approvalProgress * 0.25 +
       reviewProgress * 0.2 +
       validationProgress * 0.25)
    );

    // Determine overall status
    let status: 'COMPLIANT' | 'WARNING' | 'CRITICAL' | 'BLOCKED' = 'COMPLIANT';

    if (riskScore >= 80 || overdueItems > 5 || openObservations > 10) {
      status = 'CRITICAL';
    } else if (riskScore >= 60 || overdueItems > 2 || openObservations > 5) {
      status = 'WARNING';
    } else if (overallProgress < 50) {
      status = 'BLOCKED';
    }

    // Get next deadline
    const nextDeadline = await prisma.observation.findFirst({
      where: {
        caseId,
        deadline: {
          gt: now,
        },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      orderBy: { deadline: 'asc' },
    });

    // Get last validation timestamp
    const lastValidation = validationExecutions[0]?.executedAt || caseInfo.createdAt.toISOString();

    const summary = {
      caseId,
      caseTitle: caseInfo.title,
      currentStage: caseInfo.currentStage,
      overallProgress,
      checklistProgress,
      approvalProgress,
      reviewProgress,
      validationProgress,
      riskScore,
      openObservations,
      pendingSignatures,
      overdueItems,
      lastValidation,
      nextDeadline: nextDeadline?.deadline,
      status,
    };

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Error fetching validation summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation summary' },
      { status: 500 }
    );
  }
}