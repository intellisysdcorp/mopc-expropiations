import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CaseStage, CaseStatus, Prisma } from '@/prisma/client';
import { calculateProgressPercentage } from '@/lib/stage-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

// Type definitions
export interface ChecklistCompletion {
  id: string;
  caseStageId: string;
  itemId: string;
  isCompleted: boolean;
  completedAt: Date | null;
  completedBy: string | null;
  notes: string | null;
  attachmentPath: string | null;
  validationResult: Prisma.JsonValue;
  validationErrors: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  item: {
    id: string;
    templateId: string;
    title: string;
    description: string | null;
    type: string;
    isRequired: boolean;
    sequence: number;
    estimatedTime: number | null;
    validationRule: string | null;
    attachmentRequired: boolean;
    attachmentTypes: Prisma.JsonValue;
    dependencies: Prisma.JsonValue;
    autoValidate: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface StageAssignment {
  id: string;
  caseId: string;
  stage: CaseStage;
  assignedToId?: string;
  assignedBy: string | null;
  assignedAt: Date;
  dueDate: Date | null;
  isActive: boolean;
  notes: string | null;
  checklistCompletions?: ChecklistCompletion[];
}

export interface CaseWithAssignments {
  id: string;
  fileNumber: string;
  title: string;
  currentStage: CaseStage;
  status: string;
  assignedToId: string | null;
  departmentId: string;
  stageAssignments?: StageAssignment[];
}

export interface UserWithRoleAndDepartment {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: string;
    name: string;
    permissions: Prisma.JsonValue;
  };
  department?: {
    id: string;
    code: string;
    name: string;
  };
  departmentId?: string;
  isActive: boolean;
}

export interface StageTransitionData {
  toStage: CaseStage;
  reason?: string;
  observations?: string;
  approvedBy?: string;
  requiresApproval?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notifyStakeholders?: boolean;
  attachmentPath?: string;
}

export interface StageTransitionResult {
  progression: any;
  updatedCase: any;
  newStageAssignment: any;
  message: string;
  nextSteps?: string;
}

// Authentication and Authorization
export async function authenticateUser() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      throw { status: 401, message: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true, department: true }
    });

    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    return user;
  } catch (error: any) {
    if (error.status) {
      throw error;
    }
    logger.error('Error in authentication:', error);
    throw { status: 500, message: 'Internal server error' };
  }
}

export function checkStageTransitionPermission(
  user: UserWithRoleAndDepartment,
  caseData: CaseWithAssignments
): boolean {
  return user.role.name === 'super_admin' ||
         user.role.name === 'department_admin' ||
         user.role.name === 'supervisor' ||
         (user.role.name === 'analyst' && caseData.assignedToId === user.id);
}

export function checkCaseAccessPermission(
  user: UserWithRoleAndDepartment,
  caseData: CaseWithAssignments
): boolean {
  return user.role.name === 'super_admin' ||
         caseData.departmentId === user.departmentId;
}

// Database Operations
export async function getCaseWithAssignments(caseId: string): Promise<CaseWithAssignments | null> {
  try {
    return await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        stageAssignments: {
          where: { isActive: true },
          include: {
            checklistCompletions: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching case with assignments:', error);
    return null;
  }
}

export async function getStageConfigurations(
  currentStage?: CaseStage,
  targetStage?: CaseStage
) {
  try {
    const stages = await prisma.stage.findMany({
      where: {
        isActive: true,
        ...(currentStage && { stage: currentStage }),
        ...(targetStage && { stage: targetStage })
      },
      orderBy: { sequenceOrder: 'asc' }
    });

    const fromStageConfig = stages.find(s => s.stage === currentStage);
    const toStageConfig = stages.find(s => s.stage === targetStage);

    return { fromStageConfig, toStageConfig, allStages: stages };
  } catch (error) {
    logger.error('Error fetching stage configurations:', error);
    throw new Error('Failed to fetch stage configurations');
  }
}

export async function validateChecklistCompletion(
  caseId: string,
  currentStage: CaseStage
): Promise<{ valid: boolean; missingItems?: any[] }> {
  try {
    const currentStageAssignment = await prisma.caseStageAssignment.findFirst({
      where: {
        caseId,
        stage: currentStage,
        isActive: true
      },
      include: {
        checklistCompletions: {
          include: {
            item: true
          }
        }
      }
    });

    if (!currentStageAssignment) {
      return { valid: true };
    }

    const requiredChecklistItems = await prisma.stageChecklist.findMany({
      where: {
        stage: currentStage,
        isRequired: true,
        isActive: true
      }
    });

    const completedRequiredItems = currentStageAssignment.checklistCompletions.filter(
      completion => completion.isCompleted &&
      requiredChecklistItems.some(item => item.id === completion.itemId)
    );

    if (completedRequiredItems.length < requiredChecklistItems.length) {
      return {
        valid: false,
        missingItems: requiredChecklistItems.filter(
          item => !completedRequiredItems.some(completion => completion.itemId === item.id)
        )
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error('Error validating checklist completion:', error);
    return { valid: false };
  }
}

// Stage Transition Operations
export async function createStageProgression(
  caseId: string,
  fromStage: CaseStage,
  toStage: CaseStage,
  progressionType: 'FORWARD' | 'BACKWARD' | 'JUMP',
  transitionData: StageTransitionData,
  request: NextRequest,
  duration?: number
) {
  try {
    return await prisma.stageProgression.create({
      data: {
        caseId,
        fromStage,
        toStage,
        progressionType,
        reason: transitionData.reason || null,
        observations: transitionData.observations || null,
        approvedBy: transitionData.approvedBy || null,
        approvedAt: new Date(),
        duration: duration || null,
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   null,
      }
    });
  } catch (error) {
    logger.error('Error creating stage progression:', error);
    throw new Error('Failed to create stage progression');
  }
}

export async function updateCaseStage(
  caseId: string,
  newStage: CaseStage,
  status?: CaseStatus
) {
  try {
    // Get current case to preserve progress percentage for special stages
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { progressPercentage: true }
    });

    // Calculate progress percentage based on stage position
    const progressPercentage = calculateProgressPercentage(
      newStage,
      existingCase?.progressPercentage || 0
    );

    return await prisma.case.update({
      where: { id: caseId },
      data: {
        currentStage: newStage,
        status: status || CaseStatus.EN_PROGRESO,
        progressPercentage
      }
    });
  } catch (error) {
    logger.error('Error updating case stage:', error);
    throw new Error('Failed to update case stage');
  }
}

export async function deactivateStageAssignment(
  caseId: string,
  stage: CaseStage,
  notes?: string
) {
  try {
    return await prisma.caseStageAssignment.updateMany({
      where: {
        caseId,
        stage,
        isActive: true
      },
      data: {
        isActive: false,
        ...(notes && { notes })
      }
    });
  } catch (error) {
    logger.error('Error deactivating stage assignment:', error);
    throw new Error('Failed to deactivate stage assignment');
  }
}

export async function createStageAssignment(
  caseId: string,
  stage: CaseStage,
  assignedBy: string,
  targetStageConfig: any,
  notes?: string
) {
  try {
    return await prisma.caseStageAssignment.create({
      data: {
        caseId,
        stage,
        assignedBy,
        dueDate: targetStageConfig.estimatedDuration ?
          new Date(Date.now() + (targetStageConfig.estimatedDuration * 24 * 60 * 60 * 1000)) :
          null,
        isActive: true,
        notes: notes || null
      }
    });
  } catch (error) {
    logger.error('Error creating stage assignment:', error);
    throw new Error('Failed to create stage assignment');
  }
}

// Auto-assignment logic
export function isValidAutoAssignmentRules(rules: Prisma.JsonValue): rules is {
  autoAssign: boolean;
  assignByRole: string;
  assignToDepartment?: string;
} {
  if (!rules || typeof rules !== 'object' || rules === null) {
    return false;
  }

  const rulesObj = rules as Record<string, unknown>;

  return (
    'autoAssign' in rulesObj &&
    rulesObj.autoAssign === true &&
    'assignByRole' in rulesObj &&
    typeof rulesObj.assignByRole === 'string'
  ) || false;
}

export async function handleAutoAssignment(
  caseId: string,
  toStageConfig: any
) {
  try {
    if (!toStageConfig.autoAssignmentRules) {
      return;
    }

    const rules = toStageConfig.autoAssignmentRules;

    if (!isValidAutoAssignmentRules(rules)) {
      return;
    }

    const whereClause: Prisma.UserWhereInput = {
      role: { name: rules.assignByRole },
      isActive: true,
    };

    if (rules.assignToDepartment) {
      whereClause.department = { code: rules.assignToDepartment };
    }

    const assignee = await prisma.user.findFirst({
      where: whereClause,
      orderBy: {
        assignedCases: {
          _count: 'asc'
        }
      }
    });

    if (assignee) {
      await prisma.case.update({
        where: { id: caseId },
        data: { assignedToId: assignee.id }
      });
    }
  } catch (error) {
    logger.error('Error handling auto-assignment:', error);
    // Don't throw error, as this is not critical for the main operation
  }
}

// Activity Logging and History
export async function logStageTransitionActivity(
  userId: string,
  caseId: string,
  fileNumber: string,
  fromStage: CaseStage,
  toStage: CaseStage,
  progressionType: 'FORWARD' | 'BACKWARD' | 'JUMP',
  transitionData: StageTransitionData,
  progressionId: string
) {
  try {
    await prisma.activity.create({
      data: {
        userId,
        action: 'STAGE_CHANGED',
        entityType: 'case',
        entityId: caseId,
        description: `Case ${fileNumber} progressed from ${fromStage} to ${toStage}`,
        metadata: {
          progressionType,
          reason: transitionData.reason,
          observations: transitionData.observations,
          requiresApproval: transitionData.requiresApproval,
          priority: transitionData.priority,
          progressionId
        }
      }
    });
  } catch (error) {
    logger.error('Error logging stage transition activity:', error);
    // Don't throw error, as this is not critical for the main operation
  }
}

export async function createCaseHistory(
  caseId: string,
  action: string,
  field: string,
  previousValue: string,
  newValue: string,
  changedById: string,
  transitionData: StageTransitionData,
  request: NextRequest,
  duration?: number
) {
  try {
    await prisma.caseHistory.create({
      data: {
        caseId,
        action,
        field,
        previousValue,
        newValue,
        reason: transitionData.reason || null,
        notes: transitionData.observations || null,
        changedById,
        ipAddress: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   null,
        duration: duration || null
      }
    });
  } catch (error) {
    logger.error('Error creating case history:', error);
    // Don't throw error, as this is not critical for the main operation
  }
}

// Return-specific Functions
export async function getAvailableReturnStages(caseId: string) {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        stageProgressions: {
          include: {
            fromStageConfig: {
              select: {
                stage: true,
                name: true,
                description: true,
                sequenceOrder: true
              }
            },
            toStageConfig: {
              select: {
                stage: true,
                name: true,
                description: true,
                sequenceOrder: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!caseData) {
      throw { status: 404, message: 'Case not found' };
    }

    const allStages = await prisma.stage.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' }
    });

    const currentStageIndex = allStages.findIndex(s => s.stage === caseData.currentStage);
    const completedStages = allStages.slice(0, currentStageIndex);

    const recentReturns = caseData.stageProgressions.filter(
      p => p.progressionType === 'BACKWARD' &&
           p.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const availableStages = completedStages.map(stage => {
      const lastVisit = caseData.stageProgressions.find(
        p => p.toStage === stage.stage
      );

      const recentReturnCount = recentReturns.filter(
        p => p.toStage === stage.stage
      ).length;

      return {
        stage: stage.stage,
        name: stage.name,
        description: stage.description,
        sequenceOrder: stage.sequenceOrder,
        responsibleDepartment: stage.responsibleDepartment,
        lastVisitDate: lastVisit?.createdAt,
        visitCount: caseData.stageProgressions.filter(
          p => p.toStage === stage.stage
        ).length,
        recentReturnCount,
        isRecommended: stage.sequenceOrder >= currentStageIndex - 2,
        warning: recentReturnCount > 1 ? 'Este caso ha sido devuelto a esta etapa recientemente' : undefined
      };
    });

    return {
      currentStage: caseData.currentStage,
      availableStages,
      recentReturns: recentReturns.map(r => ({
        toStage: r.toStage,
        toStageName: r.toStageConfig?.name,
        reason: r.reason,
        observations: r.observations,
        createdAt: r.createdAt,
        createdBy: r.approvedBy
      }))
    };
  } catch (error: any) {
    if (error.status) {
      throw error;
    }
    logger.error('Error fetching available return stages:', error);
    throw { status: 500, message: 'Internal server error' };
  }
}

export async function resetChecklistCompletions(
  caseStageId: string,
  currentStageName: string
) {
  try {
    const existingChecklistCompletions = await prisma.checklistCompletion.findMany({
      where: {
        caseStageId
      }
    });

    if (existingChecklistCompletions.length > 0) {
      await prisma.checklistCompletion.updateMany({
        where: {
          caseStageId
        },
        data: {
          isCompleted: false,
          completedAt: null,
          completedBy: null,
          notes: `Reiniciado por devolución desde ${currentStageName}`
        }
      });
    }
  } catch (error) {
    logger.error('Error resetting checklist completions:', error);
    // Don't throw error, as this is not critical for the main operation
  }
}

// Error Handling
export function handleApiError(error: any): Response {
  if (error instanceof z.ZodError) {
    return new Response(
      JSON.stringify({ error: 'Validation error', details: error.issues }),
      { status: 400 }
    );
  }

  if (error.status) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.status }
    );
  }

  logger.error('Unexpected error:', error);
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500 }
  );
}