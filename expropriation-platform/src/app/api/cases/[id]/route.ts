import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { logger } from '@/lib/logger'
import { UpdateCaseSchema, CaseStatusUpdateSchema, CaseStageUpdateSchema, CaseAssignmentSchema } from '@/lib/validations/case'

// GET /api/cases/[id] - Get a specific case
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the case
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId, deletedAt: null },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true
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
        },
        documents: {
          where: {
            status: { not: 'ARCHIVED' } // Exclude archived documents
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        histories: {
          include: {
            changedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        caseMeetings: {
          orderBy: { scheduledStart: 'desc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            documents: {
              where: {
                status: { not: 'ARCHIVED' } // Exclude archived documents from count
              }
            },
            histories: true,
            activities: true,
            caseMeetings: true
          }
        }
      }
    })

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check access permissions
    const role = user.role.name as string
    const hasAccess =
      role === 'SUPER_ADMIN' ||
      caseRecord.departmentId === user.departmentId ||
      caseRecord.createdById === user.id ||
      caseRecord.assignedToId === user.id ||
      caseRecord.supervisedById === user.id

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Log case view
    await logActivity({
      userId: user.id,
      action: 'VIEWED',
      entityType: 'case',
      entityId: caseRecord.id,
      description: `Viewed case ${caseRecord.fileNumber}`,
      metadata: {
        fileNumber: caseRecord.fileNumber,
        title: caseRecord.title
      }
    })

    return NextResponse.json(caseRecord)
  } catch (error) {
    logger.error('Error fetching case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/cases/[id] - Update a case
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
    const validationResult = UpdateCaseSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

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
    const hasUpdatePermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingCase.departmentId === user.departmentId) ||
      (role === 'SUPERVISOR' && existingCase.supervisedById === user.id) ||
      (role === 'ANALYST' && existingCase.assignedToId === user.id) ||
      existingCase.createdById === user.id

    if (!hasUpdatePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update this case' },
        { status: 403 }
      )
    }

    // Handle file number uniqueness check
    if (updateData.fileNumber && updateData.fileNumber !== existingCase.fileNumber) {
      const duplicateCase = await prisma.case.findUnique({
        where: { fileNumber: updateData.fileNumber }
      })

      if (duplicateCase) {
        return NextResponse.json(
          { error: 'Case with this file number already exists' },
          { status: 409 }
        )
      }
    }

    // Handle department change
    if (updateData.departmentId && updateData.departmentId !== existingCase.departmentId) {
      if (role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Only super admins can change case department' },
          { status: 403 }
        )
      }

      const newDepartment = await prisma.department.findUnique({
        where: { id: updateData.departmentId }
      })

      if (!newDepartment) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 })
      }
    }

    // Handle assignment changes
    if (updateData.assignedToId && updateData.assignedToId !== existingCase.assignedToId) {
      const newAssignee = await prisma.user.findUnique({
        where: { id: updateData.assignedToId }
      })

      if (!newAssignee) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
      }

      if (newAssignee.departmentId !== (updateData.departmentId || existingCase.departmentId)) {
        return NextResponse.json(
          { error: 'Assigned user must belong to the case department' },
          { status: 400 }
        )
      }
    }

    // Track changes for history
    const changes: Record<string, { from: any; to: any }> = {}
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] !== existingCase[key as keyof typeof existingCase]) {
        changes[key] = {
          from: existingCase[key as keyof typeof existingCase],
          to: updateData[key as keyof typeof updateData]
        }
      }
    })

    // Update the case
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
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
        },
        supervisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Log case update
    await logActivity({
      userId: user.id,
      action: 'UPDATED',
      entityType: 'case',
      entityId: updatedCase.id,
      description: `Updated case ${updatedCase.fileNumber}`,
      metadata: {
        fileNumber: updatedCase.fileNumber,
        changes,
        updatedFields: Object.keys(changes)
      }
    })

    // Create history entries for each significant change
    for (const [field, change] of Object.entries(changes)) {
      await prisma.caseHistory.create({
        data: {
          caseId: updatedCase.id,
          changedById: user.id,
          action: 'field_update',
          field,
          previousValue: JSON.stringify(change.from),
          newValue: JSON.stringify(change.to),
          notes: `Campo ${field} actualizado`
        }
      })
    }

    return NextResponse.json(updatedCase)
  } catch (error) {
    logger.error('Error updating case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cases/[id] - Soft delete a case
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params

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
      where: { id: caseId, deletedAt: null }
    })

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check permissions (only admins can delete cases)
    const role = user.role.name as string
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete cases' },
        { status: 403 }
      )
    }

    if (role === 'DEPARTMENT_ADMIN' && existingCase.departmentId !== user.departmentId) {
      return NextResponse.json(
        { error: 'You can only delete cases from your department' },
        { status: 403 }
      )
    }

    // Soft delete the case
    await prisma.case.update({
      where: { id: caseId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id
      }
    })

    // Log case deletion
    await logActivity({
      userId: user.id,
      action: 'DELETED',
      entityType: 'case',
      entityId: caseId,
      description: `Deleted case ${existingCase.fileNumber}`,
      metadata: {
        fileNumber: existingCase.fileNumber,
        title: existingCase.title,
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Case deleted successfully' })
  } catch (error) {
    logger.error('Error deleting case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}