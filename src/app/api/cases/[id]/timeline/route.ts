import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CaseStage } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

interface TimelineEvent {
  id: string;
  type: 'stage_start' | 'stage_complete' | 'stage_return' | 'document_upload' | 'assignment_change' | 'note_added';
  stage?: CaseStage;
  stageName?: string;
  title: string;
  description?: string;
  timestamp: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: any;
  duration?: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface TimelineStage {
  stage: CaseStage;
  name: string;
  description: string;
  sequenceOrder: number;
  responsibleDepartment: string;
  estimatedDuration: number;
  status: 'completed' | 'current' | 'future' | 'skipped';
  startDate: Date | undefined;
  endDate: Date | undefined;
  duration: number | undefined;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | undefined;
  checklistProgress: {
    total: number;
    completed: number;
    percentage: number;
  };
  events: TimelineEvent[];
}

interface TimelineResponse {
  case: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: CaseStage;
    status: string;
    startDate: Date;
    expectedEndDate?: Date;
    actualEndDate?: Date;
    progressPercentage: number;
  };
  stages: TimelineStage[];
  events: TimelineEvent[];
  statistics: {
    totalDuration: number;
    averageStageDuration: number;
    completedStages: number;
    remainingStages: number;
    overdueStages: number;
  };
}

export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    if (!caseId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    // Get comprehensive case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        supervisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        stageProgressions: {
          include: {
            fromStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
                responsibleDepartment: true
              }
            },
            toStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
                responsibleDepartment: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        stageAssignments: {
          include: {
            stageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
                responsibleDepartment: true,
                estimatedDuration: true
              }
            },
            checklistCompletions: {
              include: {
                item: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    isRequired: true
                  }
                }
              }
            }
          },
          orderBy: {
            assignedAt: 'asc'
          }
        },
        documents: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        histories: {
          include: {
            changedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get user permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess = user.role.name === 'super_admin' ||
                     caseData.departmentId === user.departmentId ||
                     caseData.assignedToId === user.id ||
                     caseData.supervisedById === user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all stages for timeline
    const allStages = await prisma.stage.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' }
    });

    // Build timeline data
    const timeline = buildTimeline(caseData, allStages);

    return NextResponse.json(timeline);

  } catch (error) {
    logger.error('Error fetching case timeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildTimeline(caseData: any, allStages: any[]): TimelineResponse {
  // Initialize stages data
  const stages: TimelineStage[] = allStages.map(stage => {
    const assignment = caseData.stageAssignments.find(
      (a: any) => a.stage === stage.stage && a.isActive
    );

    const relevantProgressions = caseData.stageProgressions.filter(
      (p: any) => p.toStage === stage.stage || p.fromStage === stage.stage
    );

    const lastProgression = relevantProgressions[relevantProgressions.length - 1];

    // Determine stage status
    let status: 'completed' | 'current' | 'future' | 'skipped' = 'future';
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let duration: number | undefined;

    if (caseData.currentStage === stage.stage) {
      status = 'current';
      startDate = assignment?.assignedAt;
    } else if (stage.sequenceOrder < allStages.find(s => s.stage === caseData.currentStage)?.sequenceOrder) {
      status = 'completed';
      startDate = assignment?.assignedAt;
      endDate = lastProgression?.createdAt;
      if (startDate && endDate) {
        duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate checklist progress
    const checklistItems = caseData.stageAssignments
      .find((a: any) => a.stage === stage.stage)
      ?.checklistCompletions || [];

    const totalChecklistItems = checklistItems.filter((c: any) => c.item.isRequired).length;
    const completedChecklistItems = checklistItems.filter((c: any) => c.isCompleted && c.item.isRequired).length;
    const checklistPercentage = totalChecklistItems > 0 ? (completedChecklistItems / totalChecklistItems) * 100 : 100;

    // Build events for this stage
    const events: TimelineEvent[] = [];

    // Add stage start event
    if (assignment) {
      events.push({
        id: `stage-start-${stage.stage}`,
        type: 'stage_start',
        stage: stage.stage,
        stageName: stage.name,
        title: `Inicio de etapa: ${stage.name}`,
        description: `La etapa ${stage.name} ha sido iniciada`,
        timestamp: assignment.assignedAt,
        user: {
          id: assignment.assignedBy || 'system',
          name: 'System',
          email: 'system@mopc.gob.do'
        },
        metadata: {
          assignedBy: assignment.assignedBy,
          notes: assignment.notes
        },
        isCompleted: status === 'completed',
        isCurrent: status === 'current'
      });
    }

    // Add checklist completion events
    checklistItems
      .filter((c: any) => c.isCompleted)
      .forEach((completion: any) => {
        events.push({
          id: `checklist-${completion.id}`,
          type: 'note_added',
          stage: stage.stage,
          stageName: stage.name,
          title: `Elemento completado: ${completion.item.title}`,
          description: completion.notes || `Se completó el elemento requerido: ${completion.item.title}`,
          timestamp: completion.completedAt || completion.createdAt,
          user: {
            id: completion.completedBy || 'system',
            name: 'System',
            email: 'system@mopc.gob.do'
          },
          metadata: {
            checklistId: completion.checklistId,
            itemType: completion.item.type,
            attachmentPath: completion.attachmentPath
          },
          isCompleted: true,
          isCurrent: false
        });
      });

    // Add document upload events
    caseData.documents
      .filter((doc: any) => {
        // Check if document was uploaded during this stage
        const docDate = new Date(doc.createdAt);
        const stageStart = assignment?.assignedAt;
        const stageEnd = status === 'completed' ? endDate : new Date();
        return stageStart && stageEnd && docDate >= stageStart && docDate <= stageEnd;
      })
      .forEach((doc: any) => {
        events.push({
          id: `document-${doc.id}`,
          type: 'document_upload',
          stage: stage.stage,
          stageName: stage.name,
          title: `Documento subido: ${doc.title}`,
          description: `Se subió el documento: ${doc.title} (${doc.fileName})`,
          timestamp: doc.createdAt,
          user: {
            id: doc.uploadedBy.id,
            name: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
            email: doc.uploadedBy.email
          },
          metadata: {
            documentId: doc.id,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType
          },
          isCompleted: true,
          isCurrent: false
        });
      });

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      stage: stage.stage,
      name: stage.name,
      description: stage.description,
      sequenceOrder: stage.sequenceOrder,
      responsibleDepartment: stage.responsibleDepartment,
      estimatedDuration: stage.estimatedDuration || 0,
      status,
      startDate,
      endDate,
      duration,
      assignee: caseData.assignedTo ? {
        id: caseData.assignedTo.id,
        name: `${caseData.assignedTo.firstName} ${caseData.assignedTo.lastName}`,
        email: caseData.assignedTo.email
      } : undefined,
      checklistProgress: {
        total: totalChecklistItems,
        completed: completedChecklistItems,
        percentage: checklistPercentage
      },
      events
    };
  });

  // Build all events chronologically
  const allEvents: TimelineEvent[] = [];

  // Add case creation event
  allEvents.push({
    id: 'case-created',
    type: 'stage_start',
    stage: CaseStage.AVALUO,
    stageName: 'Recepción de Solicitud',
    title: 'Caso creado',
    description: `Caso ${caseData.fileNumber} ha sido creado`,
    timestamp: caseData.createdAt,
    user: {
      id: caseData.createdBy.id,
      name: `${caseData.createdBy.firstName} ${caseData.createdBy.lastName}`,
      email: caseData.createdBy.email
    },
    isCompleted: true,
    isCurrent: false
  });

  // Add stage progression events
  caseData.stageProgressions.forEach((progression: any) => {
    const eventType = progression.progressionType === 'BACKWARD' ? 'stage_return' : 'stage_complete';

    allEvents.push({
      id: `progression-${progression.id}`,
      type: eventType,
      stage: progression.toStage,
      stageName: progression.toStageConfig?.name,
      title: eventType === 'stage_return'
        ? `Devuelto a: ${progression.toStageConfig?.name}`
        : `Completado: ${progression.fromStageConfig?.name || 'Inicio'}`,
      description: progression.observations || progression.reason || `Caso movido de ${progression.fromStage} a ${progression.toStage}`,
      timestamp: progression.createdAt,
      user: {
        id: progression.approvedBy || 'system',
        name: 'System',
        email: 'system@mopc.gob.do'
      },
      metadata: {
        progressionType: progression.progressionType,
        fromStage: progression.fromStage,
        toStage: progression.toStage,
        reason: progression.reason,
        observations: progression.observations,
        duration: progression.duration
      },
      duration: progression.duration || undefined,
      isCompleted: true,
      isCurrent: false
    });
  });

  // Add assignment change events
  caseData.histories
    .filter((history: any) => history.action === 'assignment_change')
    .forEach((history: any) => {
      allEvents.push({
        id: `assignment-${history.id}`,
        type: 'assignment_change',
        title: 'Cambio de asignación',
        description: history.notes || 'La asignación del caso ha sido modificada',
        timestamp: history.createdAt,
        user: {
          id: history.changedBy.id,
          name: `${history.changedBy.firstName} ${history.changedBy.lastName}`,
          email: history.changedBy.email
        },
        metadata: {
          previousValue: history.previousValue,
          newValue: history.newValue,
          reason: history.reason
        },
        isCompleted: true,
        isCurrent: false
      });
    });

  // Sort all events by timestamp
  allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Calculate statistics
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const currentStageIndex = stages.findIndex(s => s.status === 'current');
  const remainingStages = stages.length - currentStageIndex - 1;

  const totalDuration = stages
    .filter(s => s.duration !== undefined)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  const averageStageDuration = completedStages > 0 ? totalDuration / completedStages : 0;

  const overdueStages = stages.filter(s =>
    s.status === 'current' &&
    s.estimatedDuration > 0 &&
    s.duration &&
    s.duration > s.estimatedDuration
  ).length;

  return {
    case: {
      id: caseData.id,
      fileNumber: caseData.fileNumber,
      title: caseData.title,
      currentStage: caseData.currentStage,
      status: caseData.status,
      startDate: caseData.startDate,
      expectedEndDate: caseData.expectedEndDate,
      actualEndDate: caseData.actualEndDate,
      progressPercentage: caseData.progressPercentage
    },
    stages,
    events: allEvents,
    statistics: {
      totalDuration,
      averageStageDuration,
      completedStages,
      remainingStages,
      overdueStages
    }
  };
}