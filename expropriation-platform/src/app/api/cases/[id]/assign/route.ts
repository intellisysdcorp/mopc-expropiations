import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { CaseAssignmentSchema } from '@/lib/validations/case'
import { logger } from '@/lib/logger';

// PUT /api/cases/[id]/assign - Assign or reassign a case
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
    const validationResult = CaseAssignmentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { assignedToId, supervisedById, reason } = validationResult.data

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
    const hasAssignmentPermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingCase.departmentId === user.departmentId) ||
      (role === 'SUPERVISOR' && existingCase.supervisedById === user.id)

    if (!hasAssignmentPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign cases' },
        { status: 403 }
      )
    }

    // Verify assigned user exists and belongs to same department
    let assignedUser = null
    if (assignedToId) {
      assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: { role: true }
      })

      if (!assignedUser) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
      }

      if (assignedUser.departmentId !== existingCase.departmentId) {
        return NextResponse.json(
          { error: 'Assigned user must belong to the same department' },
          { status: 400 }
        )
      }

      // Check if assigned user has appropriate role
      if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ANALYST', 'SUPERVISOR'].includes(assignedUser.role.name as string)) {
        return NextResponse.json(
          { error: 'Assigned user must have appropriate role' },
          { status: 400 }
        )
      }
    }

    // Verify supervisor exists and has appropriate role
    let supervisor = null
    if (supervisedById) {
      supervisor = await prisma.user.findUnique({
        where: { id: supervisedById },
        include: { role: true }
      })

      if (!supervisor) {
        return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 })
      }

      if (supervisor.departmentId !== existingCase.departmentId) {
        return NextResponse.json(
          { error: 'Supervisor must belong to the same department' },
          { status: 400 }
        )
      }

      if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR'].includes(supervisor.role.name as string)) {
        return NextResponse.json(
          { error: 'Supervisor must have admin or supervisor role' },
          { status: 400 }
        )
      }
    }

    // Track changes
    const changes: Record<string, { from: any; to: any }> = {}

    if (assignedToId !== existingCase.assignedToId) {
      changes.assignedTo = {
        from: existingCase.assignedTo,
        to: assignedUser
      }
    }

    if (supervisedById !== existingCase.supervisedById) {
      changes.supervisedBy = {
        from: existingCase.supervisedBy,
        to: supervisor
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No changes to assignment' })
    }

    // Update case assignment
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        assignedToId,
        supervisedById
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
            email: true,
            jobTitle: true
          }
        },
        supervisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true
          }
        }
      }
    })

    // Log assignment change
    await logActivity({
      userId: user.id,
      action: 'ASSIGNMENT_CHANGED',
      entityType: 'case',
      entityId: updatedCase.id,
      description: `Updated assignment for case ${updatedCase.fileNumber}`,
      metadata: {
        fileNumber: updatedCase.fileNumber,
        previousAssignment: {
          assignedTo: existingCase.assignedTo,
          supervisedBy: existingCase.supervisedBy
        },
        newAssignment: {
          assignedTo: assignedUser,
          supervisedBy: supervisor
        },
        reason
      }
    })

    // Create case history entry for assignment change
    await prisma.caseHistory.create({
      data: {
        caseId: updatedCase.id,
        changedById: user.id,
        action: 'assignment_change',
        previousValue: JSON.stringify({
          assignedTo: existingCase.assignedTo,
          supervisedBy: existingCase.supervisedBy
        }),
        newValue: JSON.stringify({
          assignedTo: assignedUser,
          supervisedBy: supervisor
        }),
        reason,
        notes: reason || 'Asignación de caso actualizada'
      }
    })

    // Create notifications for newly assigned users
    if (assignedToId && assignedToId !== existingCase.assignedToId && assignedToId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          title: 'Nuevo Casio Asignado',
          message: `Te ha sido asignado el caso ${updatedCase.fileNumber}: ${updatedCase.title}`,
          type: 'TASK_ASSIGNED',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    if (supervisedById && supervisedById !== existingCase.supervisedById && supervisedById !== user.id) {
      await prisma.notification.create({
        data: {
          userId: supervisedById,
          title: 'Nuevo Casio para Supervisión',
          message: `Se te ha asignado supervisar el caso ${updatedCase.fileNumber}: ${updatedCase.title}`,
          type: 'TASK_ASSIGNED',
          entityType: 'case',
          entityId: updatedCase.id
        }
      })
    }

    return NextResponse.json(updatedCase)
  } catch (error) {
    logger.error('Error updating case assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}