import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { CaseStageUpdateSchema } from '@/lib/validations/case'
import { calculateProgressPercentage, isValidStageTransition } from '@/lib/stage-utils'
import { URLParams } from '@/types';

// PUT /api/cases/[id]/stage - Update case stage
export async function PUT(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params
    if (!caseId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    const body = await request.json()
    const validationResult = CaseStageUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { stage, reason, notes } = validationResult.data

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get existing case
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId, deletedAt: null },
      include: {
        department: true,
        assignedTo: true,
        supervisedBy: true
      }
    })

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check permissions
    const role = user.role.name as string
    const hasStagePermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingCase.departmentId === user.departmentId) ||
      (role === 'SUPERVISOR' && existingCase.supervisedById === user.id) ||
      (role === 'ANALYST' && existingCase.assignedToId === user.id)

    if (!hasStagePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update case stage' },
        { status: 403 }
      )
    }

    const currentStage = existingCase.currentStage

    // Validate stage transition
    const transitionValidation = isValidStageTransition(currentStage, stage)
    if (!transitionValidation.valid) {
      return NextResponse.json(
        { error: transitionValidation.reason || 'Invalid stage transition' },
        { status: 400 }
      )
    }

    // Calculate duration in current stage
    const stageStartDate = existingCase.updatedAt // This is approximate, in production you'd track actual stage start dates
    const durationInDays = Math.floor((new Date().getTime() - stageStartDate.getTime()) / (1000 * 60 * 60 * 24))

    // Update case stage
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        currentStage: stage,
        // Update progress percentage based on stage (special stages keep current progress)
        progressPercentage: calculateProgressPercentage(stage, existingCase.progressPercentage),
        // Update status based on stage
        status: stage === 'CIERRE_ARCHIVO' ? 'COMPLETADO' :
                stage === 'SUSPENDED' ? 'SUSPENDED' :
                stage === 'CANCELLED' ? 'CANCELLED' :
                existingCase.status === 'PENDIENTE' ? 'EN_PROGRESO' : existingCase.status
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Log stage change
    await logActivity({
      userId: user.id,
      action: 'STAGE_CHANGED',
      entityType: 'case',
      entityId: updatedCase.id,
      description: `Changed case ${updatedCase.fileNumber} stage from ${currentStage} to ${stage}`,
      metadata: {
        fileNumber: updatedCase.fileNumber,
        previousStage: currentStage,
        newStage: stage,
        durationInDays,
        reason,
        notes
      }
    })

    // Create case history entry
    await prisma.caseHistory.create({
      data: {
        caseId: updatedCase.id,
        changedById: user.id,
        action: 'stage_change',
        previousValue: JSON.stringify({ stage: currentStage }),
        newValue: JSON.stringify({ stage }),
        reason: reason || null,
        notes: notes || `Etapa cambiada de ${currentStage} a ${stage}`,
        duration: durationInDays
      }
    })

    return NextResponse.json(updatedCase)
  } catch (error) {
    logger.error('Error updating case stage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}