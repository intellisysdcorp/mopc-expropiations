import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CaseStage } from '@prisma/client';
import { z } from 'zod';
import {
  authenticateUser,
  checkStageTransitionPermission,
  getCaseWithAssignments,
  getStageConfigurations,
  createStageProgression,
  updateCaseStage,
  deactivateStageAssignment,
  createStageAssignment,
  logStageTransitionActivity,
  createCaseHistory,
  getAvailableReturnStages,
  resetChecklistCompletions,
  handleApiError,
  type StageTransitionData,
  type CaseWithAssignments
} from '@/lib/services/stage-transition.service';

const stageReturnSchema = z.object({
  toStage: z.enum(CaseStage),
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
  observations: z.string().min(20, 'Las observaciones deben tener al menos 20 caracteres'),
  requiresApproval: z.boolean().default(true),
  approverId: z.string().optional(),
  attachmentPath: z.string().optional(),
  notifyStakeholders: z.boolean().default(true),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('high')
});

// Get available stages for return
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // Authenticate user
    const user = await authenticateUser();

    // Get available return stages
    const returnData = await getAvailableReturnStages(caseId);

    // Check if user has permission to access this case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        assignedToId: true,
        departmentId: true
      }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!checkStageTransitionPermission(user, caseData as CaseWithAssignments)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(returnData);

  } catch (error: any) {
    return handleApiError(error);
  }
}

// Process stage return
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = stageReturnSchema.parse(body);

    // Authenticate user
    const user = await authenticateUser();

    // Get case data
    const caseData = await getCaseWithAssignments(caseId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check permissions
    if (!checkStageTransitionPermission(user, caseData)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get stage configurations
    const { fromStageConfig, toStageConfig } = await getStageConfigurations(
      caseData.currentStage,
      validatedData.toStage
    );

    if (!toStageConfig) {
      return NextResponse.json({ error: 'Target stage not found' }, { status: 404 });
    }

    if (!fromStageConfig) {
      return NextResponse.json({ error: 'Current stage not found' }, { status: 404 });
    }

    // Can only return to previous stages
    if (toStageConfig.sequenceOrder >= fromStageConfig.sequenceOrder) {
      return NextResponse.json({
        error: 'Invalid return',
        message: 'Solo se puede devolver a etapas anteriores'
      }, { status: 400 });
    }

    // Prepare transition data
    const transitionData: StageTransitionData = {
      toStage: validatedData.toStage,
      reason: validatedData.reason,
      observations: validatedData.observations,
      approvedBy: user.id,
      requiresApproval: validatedData.requiresApproval,
      priority: validatedData.priority,
      notifyStakeholders: validatedData.notifyStakeholders
    };

    // Calculate duration at current stage
    let duration: number | undefined = undefined;
    if (caseData.stageAssignments) {
      const currentAssignment = caseData.stageAssignments.find(
        assignment => assignment.stage === caseData.currentStage && assignment.isActive
      );
      if (currentAssignment) {
        duration = Math.floor(
          (Date.now() - currentAssignment.assignedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Create stage progression record
    const progression = await createStageProgression(
      caseId,
      caseData.currentStage,
      validatedData.toStage,
      'BACKWARD',
      transitionData,
      request,
      duration
    );

    // Update case current stage
    const updatedCase = await updateCaseStage(
      caseId,
      validatedData.toStage,
      'EN_PROGRESO'
    );

    // Deactivate current stage assignment
    await deactivateStageAssignment(
      caseId,
      caseData.currentStage,
      `Devuelto: ${validatedData.reason}`
    );

    // Create new stage assignment
    const newStageAssignment = await createStageAssignment(
      caseId,
      validatedData.toStage,
      user.id,
      toStageConfig,
      `Caso devuelto desde ${fromStageConfig.name}: ${validatedData.reason}`
    );

    // Reset checklist completions for target stage
    await resetChecklistCompletions(newStageAssignment.id, fromStageConfig.name);

    // Log activity
    await logStageTransitionActivity(
      user.id,
      caseId,
      caseData.fileNumber,
      caseData.currentStage,
      validatedData.toStage,
      'BACKWARD',
      transitionData,
      progression.id
    );

    // Create case history record
    await createCaseHistory(
      caseId,
      'stage_return',
      'currentStage',
      caseData.currentStage,
      validatedData.toStage,
      user.id,
      transitionData,
      request,
      duration
    );

    return NextResponse.json({
      success: true,
      progression,
      updatedCase,
      newStageAssignment,
      message: 'Caso devuelto exitosamente',
      nextSteps: `Revisar las observaciones y completar los requisitos pendientes en la etapa: ${toStageConfig.name}`
    });

  } catch (error: any) {
    return handleApiError(error);
  }
}