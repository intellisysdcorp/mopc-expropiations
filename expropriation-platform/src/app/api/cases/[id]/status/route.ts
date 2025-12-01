import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { CaseStatusUpdateSchema } from '@/lib/validations/case'

// PUT /api/cases/[id]/status - Update case status
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
    const validationResult = CaseStatusUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { status, reason, notes } = validationResult.data

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
    const hasStatusPermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingCase.departmentId === user.departmentId) ||
      (role === 'SUPERVISOR' && existingCase.supervisedById === user.id) ||
      (role === 'ANALYST' && existingCase.assignedToId === user.id)

    if (!hasStatusPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update case status' },
        { status: 403 }
      )
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      'PENDIENTE': ['EN_PROGRESO', 'CANCELLED', 'SUSPENDED'],
      'EN_PROGRESO': ['COMPLETADO', 'SUSPENDED', 'CANCELLED'],
      'COMPLETADO': ['ARCHIVED'],
      'SUSPENDED': ['EN_PROGRESO', 'CANCELLED'],
      'CANCELLED': ['PENDIENTE'],
      'ARCHIVED': []
    }

    const currentStatus = existingCase.status
    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${currentStatus} to ${status}` },
        { status: 400 }
      )
    }

    // Update case status
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status,
        // Set end dates based on status
        actualEndDate: (status === 'COMPLETADO' || status === 'CANCELLED') ? new Date() : existingCase.actualEndDate,
        // Update progress percentage based on status
        progressPercentage: status === 'COMPLETADO' ? 100 :
                           status === 'EN_PROGRESO' ? Math.min(existingCase.progressPercentage + 10, 90) :
                           existingCase.progressPercentage
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

    // Log status change
    await logActivity({
      userId: user.id,
      action: 'STATUS_CHANGED',
      entityType: 'case',
      entityId: updatedCase.id,
      description: `Changed case ${updatedCase.fileNumber} status from ${currentStatus} to ${status}`,
      metadata: {
        fileNumber: updatedCase.fileNumber,
        previousStatus: currentStatus,
        newStatus: status,
        reason,
        notes
      }
    })

    // Create case history entry
    await prisma.caseHistory.create({
      data: {
        caseId: updatedCase.id,
        changedById: user.id,
        action: 'status_change',
        previousValue: JSON.stringify({ status: currentStatus }),
        newValue: JSON.stringify({ status }),
        reason: reason || null,
        notes: notes || `Estado cambiado de ${currentStatus} a ${status}`
      }
    })

    // Create notification for assigned user (if different from current user)
    if (existingCase.assignedToId && existingCase.assignedToId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: existingCase.assignedToId,
          title: 'Estado del Casio Actualizado',
          message: `El caso ${updatedCase.fileNumber} ha cambiado de estado a ${status}`,
          type: 'STATUS_UPDATE',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    // Create notification for supervisor (if different from current user and assigned user)
    if (existingCase.supervisedById &&
        existingCase.supervisedById !== user.id &&
        existingCase.supervisedById !== existingCase.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: existingCase.supervisedById,
          title: 'Estado del Casio Actualizado',
          message: `El caso ${updatedCase.fileNumber} ha cambiado de estado a ${status}`,
          type: 'STATUS_UPDATE',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    return NextResponse.json(updatedCase)
  } catch (error) {
    logger.error('Error updating case status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}