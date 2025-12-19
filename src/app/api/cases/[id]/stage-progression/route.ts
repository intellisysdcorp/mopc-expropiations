import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CaseStage } from '@/prisma/client';
import { z } from 'zod';
import {
  authenticateUser,
  checkStageTransitionPermission,
  checkCaseAccessPermission,
  getCaseWithAssignments,
  getStageConfigurations,
  validateChecklistCompletion,
  createStageProgression,
  updateCaseStage,
  deactivateStageAssignment,
  createStageAssignment,
  handleAutoAssignment,
  logStageTransitionActivity,
  handleApiError,
  type StageTransitionData
} from '@/lib/services/stage-transition.service';
import { URLParams } from '@/types';

const progressionSchema = z.object({
  toStage: z.enum(CaseStage),
  reason: z.string().optional(),
  observations: z.string().optional(),
  approvedBy: z.string().optional(),
});

const returnSchema = z.object({
  toStage: z.enum(CaseStage),
  reason: z.string().min(1, 'El motivo de devolución es requerido'),
  observations: z.string().min(1, 'Las observaciones son requeridas'),
  approvedBy: z.string().optional(),
});

// Type for validated progression data
type ValidatedProgressionData = z.infer<typeof progressionSchema>;
type ValidatedReturnData = z.infer<typeof returnSchema>;

// Convert validated data to StageTransitionData
function convertToStageTransitionData(
  validatedData: ValidatedProgressionData | ValidatedReturnData
): StageTransitionData {
  const result: StageTransitionData = {
    toStage: validatedData.toStage,
  };

  // Only include properties that are defined (not undefined)
  if (validatedData.reason !== undefined) {
    result.reason = validatedData.reason;
  }
  if (validatedData.observations !== undefined) {
    result.observations = validatedData.observations;
  }
  if (validatedData.approvedBy !== undefined) {
    result.approvedBy = validatedData.approvedBy;
  }

  return result;
}

// Get stage progression history for a case
export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  const { id: caseId } = await params;
  if (!caseId) {
    return NextResponse.json(
      { error: 'Bad Request: missing key param'},
      { status: 400 }
    )
  }

  try {
    // Get case with current stage
    const currentCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        fileNumber: true,
        title: true,
        currentStage: true,
        status: true,
        departmentId: true,
        assignedToId: true,
        stageProgressions: {
          include: {
            fromStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
              }
            },
            toStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!currentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Authenticate user and check permissions
    const user = await authenticateUser();
    if (!checkCaseAccessPermission(user, currentCase)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      case: currentCase,
      progressions: currentCase.stageProgressions
    });

  } catch (error: any) {
    return handleApiError(error);
  }
}

// Progress case to next stage or return to previous stage
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  const { id: caseId } = await params;
  if (!caseId) {
    return NextResponse.json(
      { error: 'Bad Request: missing key param'},
      { status: 400 }
    )
  }

  try {
    const body = await request.json();

    // Validate request body
    const isReturn = body.type === 'return';
    const validatedData = isReturn ?
      returnSchema.parse(body) :
      progressionSchema.parse(body);

    // Authenticate user
    const user = await authenticateUser();

    // Get current case
    const currentCase = await getCaseWithAssignments(caseId);
    if (!currentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check permissions
    if (!checkStageTransitionPermission(user, currentCase)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get stage configurations
    const { fromStageConfig, toStageConfig } = await getStageConfigurations(
      currentCase.currentStage,
      validatedData.toStage
    );

    if (!toStageConfig) {
      return NextResponse.json({ error: 'Target stage not found' }, { status: 404 });
    }

    // Determine progression type
    let progressionType: 'FORWARD' | 'BACKWARD' | 'JUMP';
    if (!fromStageConfig) {
      progressionType = 'FORWARD';
    } else if (fromStageConfig.sequenceOrder < toStageConfig.sequenceOrder) {
      progressionType = 'FORWARD';
    } else if (fromStageConfig.sequenceOrder > toStageConfig.sequenceOrder) {
      progressionType = 'BACKWARD';
    } else {
      progressionType = 'JUMP';
    }

    // For forward progression, validate checklist completion
    if (progressionType === 'FORWARD' && fromStageConfig) {
      const checklistValidation = await validateChecklistCompletion(caseId, currentCase.currentStage);
      if (!checklistValidation.valid) {
        return NextResponse.json({
          error: 'Cannot progress to next stage',
          message: 'All required checklist items must be completed',
          missingItems: checklistValidation.missingItems
        }, { status: 400 });
      }
    }

    // Calculate duration at current stage
    let duration: number | undefined = undefined;
    if (fromStageConfig && currentCase.stageAssignments) {
      const currentAssignment = currentCase.stageAssignments.find(
        assignment => assignment.stage === currentCase.currentStage && assignment.isActive
      );
      if (currentAssignment) {
        duration = Math.floor(
          (Date.now() - currentAssignment.assignedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Convert validated data to proper format for service functions
    const transitionData = convertToStageTransitionData(validatedData);

    // Create stage progression record
    const progression = await createStageProgression(
      caseId,
      currentCase.currentStage,
      validatedData.toStage,
      progressionType,
      transitionData,
      request,
      duration
    );

    // Update case current stage
    const updatedCase = await updateCaseStage(
      caseId,
      validatedData.toStage,
      validatedData.toStage === CaseStage.CIERRE_ARCHIVO ? 'COMPLETADO' : 'EN_PROGRESO'
    );

    // Deactivate current stage assignment
    if (fromStageConfig) {
      await deactivateStageAssignment(caseId, currentCase.currentStage);
    }

    // Create new stage assignment
    const newStageAssignment = await createStageAssignment(
      caseId,
      validatedData.toStage,
      user.id,
      toStageConfig,
      validatedData.reason
    );

    // Handle auto-assignment
    await handleAutoAssignment(caseId, toStageConfig);

    // Log activity
    await logStageTransitionActivity(
      user.id,
      caseId,
      currentCase.fileNumber,
      currentCase.currentStage,
      validatedData.toStage,
      progressionType,
      transitionData,
      progression.id
    );

    return NextResponse.json({
      success: true,
      progression,
      updatedCase,
      newStageAssignment
    });

  } catch (error: any) {
    return handleApiError(error);
  }
}
