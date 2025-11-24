import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { CaseStageUpdateSchema } from '@/lib/validations/case'

// PUT /api/cases/[id]/stage - Update case stage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params
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

    // Define stage order for validation (main workflow stages only)
    const stageOrder = [
      'RECEPCION_SOLICITUD',
      'VERIFICACION_REQUISITOS',
      'CARGA_DOCUMENTOS',
      'ASIGNACION_ANALISTA',
      'ANALISIS_PRELIMINAR',
      'NOTIFICACION_PROPIETARIO',
      'PERITAJE_TECNICO',
      'DETERMINACION_VALOR',
      'OFERTA_COMPRA',
      'NEGOCIACION',
      'APROBACION_ACUERDO',
      'ELABORACION_ESCRITURA',
      'FIRMA_DOCUMENTOS',
      'REGISTRO_PROPIEDAD',
      'DESEMBOLSO_PAGO',
      'ENTREGA_INMUEBLE',
      'CIERRE_ARCHIVO'
    ]

    // Define special stages that aren't part of the main workflow
    const specialStages = ['SUSPENDED', 'CANCELLED']

    const currentStage = existingCase.currentStage
    const currentStageIndex = stageOrder.indexOf(currentStage)
    const newStageIndex = stageOrder.indexOf(stage)

    // Handle stage transitions based on current and target stages
    if (specialStages.includes(stage)) {
      // Allow transition to special stages from any stage
    } else if (specialStages.includes(currentStage)) {
      // Handle transitions from special stages
      if (currentStage === 'SUSPENDED') {
        // From suspended, only allow forward progression to main workflow stages
        if (newStageIndex === -1 || newStageIndex <= 0) {
          return NextResponse.json(
            { error: 'From suspended stage, can only move forward to main workflow stages' },
            { status: 400 }
          )
        }
      } else if (currentStage === 'CANCELLED') {
        // From cancelled, only allow moving back to initial stage
        if (stage !== 'RECEPCION_SOLICITUD') {
          return NextResponse.json(
            { error: 'Cancelled cases can only be moved back to initial review stage' },
            { status: 400 }
          )
        }
      }
    } else if (currentStage === 'CIERRE_ARCHIVO') {
      // From completed stage, only allow moving to suspended
      if (stage !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'Completed cases can only be suspended' },
          { status: 400 }
        )
      }
    } else if (newStageIndex === -1 || newStageIndex < currentStageIndex) {
      // For main workflow stages, don't allow backwards progression
      return NextResponse.json(
        { error: 'Cannot move backwards in workflow' },
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
        progressPercentage: stage === 'SUSPENDED' || stage === 'CANCELLED' ?
                           existingCase.progressPercentage :
                           Math.round((newStageIndex / (stageOrder.length - 1)) * 100),
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

    // Create notification for assigned user (if different from current user)
    if (existingCase.assignedToId && existingCase.assignedToId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: existingCase.assignedToId,
          title: 'Etapa del Casio Actualizada',
          message: `El caso ${updatedCase.fileNumber} ha avanzado a la etapa: ${stage}`,
          type: 'STATUS_UPDATE',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    // Create notification for supervisor (if different)
    if (existingCase.supervisedById &&
        existingCase.supervisedById !== user.id &&
        existingCase.supervisedById !== existingCase.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: existingCase.supervisedById,
          title: 'Etapa del Casio Actualizada',
          message: `El caso ${updatedCase.fileNumber} ha avanzado a la etapa: ${stage}`,
          type: 'STATUS_UPDATE',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    return NextResponse.json(updatedCase)
  } catch (error) {
    logger.error('Error updating case stage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}