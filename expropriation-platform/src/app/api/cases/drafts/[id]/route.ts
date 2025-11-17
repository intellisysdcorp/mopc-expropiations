import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { CreateCaseSchema } from '@/lib/validations/case'

// PUT /api/cases/drafts/[id] - Update a draft or convert it to a complete case
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: draftId } = await params
    const body = await request.json()
    const { convertToComplete, ...updateData } = body

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get existing draft case
    const existingDraft = await prisma.case.findUnique({
      where: { id: draftId, deletedAt: null }
    })

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft case not found' }, { status: 404 })
    }

    if (!existingDraft.isDraft) {
      return NextResponse.json({ error: 'This is not a draft case' }, { status: 400 })
    }

    // Check permissions
    const role = user.role.name.toUpperCase() as string
    const hasUpdatePermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingDraft.departmentId === user.departmentId) ||
      existingDraft.createdById === user.id

    if (!hasUpdatePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update this draft' },
        { status: 403 }
      )
    }

    // If converting to complete case
    if (convertToComplete) {
      // Validate all required fields for complete case
      const validationResult = CreateCaseSchema.safeParse({
        ...existingDraft,
        ...updateData,
        isDraft: false
      })

      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid data for complete case', details: validationResult.error.issues },
          { status: 400 }
        )
      }

      const completeCaseData = validationResult.data

      // Check if file number already exists (if changed)
      if (completeCaseData.fileNumber !== existingDraft.fileNumber) {
        const duplicateCase = await prisma.case.findUnique({
          where: { fileNumber: completeCaseData.fileNumber }
        })

        if (duplicateCase) {
          return NextResponse.json(
            { error: 'Case with this file number already exists' },
            { status: 409 }
          )
        }
      }

      // Update the draft to become a complete case
      const updatedCase = await prisma.case.update({
        where: { id: draftId },
        data: {
          ...completeCaseData,
          isDraft: false,
          startDate: existingDraft.startDate || new Date(),
          // Handle optional fields that can be null
          description: completeCaseData.description ?? null,
          propertyDescription: completeCaseData.propertyDescription ?? null,
          propertyCoordinates: completeCaseData.propertyCoordinates ?? null,
          propertyArea: completeCaseData.propertyArea ?? null,
          propertyType: completeCaseData.propertyType ?? null,
          ownerIdentification: completeCaseData.ownerIdentification ?? null,
          ownerContact: completeCaseData.ownerContact ?? null,
          ownerEmail: completeCaseData.ownerEmail ?? null,
          ownerAddress: completeCaseData.ownerAddress ?? null,
          ownerType: completeCaseData.ownerType ?? null,
          estimatedValue: completeCaseData.estimatedValue ?? null,
          expropriationDecree: completeCaseData.expropriationDecree ?? null,
          judicialCaseNumber: completeCaseData.judicialCaseNumber ?? null,
          legalStatus: completeCaseData.legalStatus ?? null,
          assignedToId: completeCaseData.assignedToId ?? null,
          supervisedById: completeCaseData.supervisedById ?? null,
          expectedEndDate: completeCaseData.expectedEndDate ?? null
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

      // Log conversion to complete case
      await logActivity({
        userId: user.id,
        action: 'UPDATED',
        entityType: 'case',
        entityId: updatedCase.id,
        description: `Converted draft ${updatedCase.fileNumber} to complete case`,
        metadata: {
          fileNumber: updatedCase.fileNumber,
          title: updatedCase.title,
          convertedFromDraft: true
        }
      })

      // Create case history entry for conversion
      await prisma.caseHistory.create({
        data: {
          caseId: updatedCase.id,
          changedById: user.id,
          action: 'draft_converted',
          newValue: JSON.stringify({
            fileNumber: updatedCase.fileNumber,
            title: updatedCase.title,
            status: updatedCase.status,
            isDraft: false
          }),
          notes: 'Borrador convertido a caso completo'
        }
      })

      return NextResponse.json(updatedCase)
    } else {
      // Just updating the draft (relaxed validation)
      const updatedDraft = await prisma.case.update({
        where: { id: draftId },
        data: {
          ...updateData,
          updatedAt: new Date()
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
          }
        }
      })

      // Log draft update
      await logActivity({
        userId: user.id,
        action: 'UPDATED',
        entityType: 'case',
        entityId: updatedDraft.id,
        description: `Updated draft case ${updatedDraft.fileNumber}`,
        metadata: {
          fileNumber: updatedDraft.fileNumber,
          isDraft: true
        }
      })

      return NextResponse.json(updatedDraft)
    }
  } catch (error) {
    logger.error('Error updating draft case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cases/drafts/[id] - Delete a draft case
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: draftId } = await params

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get existing draft case
    const existingDraft = await prisma.case.findUnique({
      where: { id: draftId, deletedAt: null }
    })

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft case not found' }, { status: 404 })
    }

    if (!existingDraft.isDraft) {
      return NextResponse.json({ error: 'This is not a draft case' }, { status: 400 })
    }

    // Check permissions (owner or admin can delete drafts)
    const role = user.role.name.toUpperCase() as string
    const hasDeletePermission =
      role === 'SUPER_ADMIN' ||
      (role === 'DEPARTMENT_ADMIN' && existingDraft.departmentId === user.departmentId) ||
      existingDraft.createdById === user.id

    if (!hasDeletePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this draft' },
        { status: 403 }
      )
    }

    // Soft delete the draft
    await prisma.case.update({
      where: { id: draftId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id
      }
    })

    // Log draft deletion
    await logActivity({
      userId: user.id,
      action: 'DELETED',
      entityType: 'case',
      entityId: draftId,
      description: `Deleted draft case ${existingDraft.fileNumber}`,
      metadata: {
        fileNumber: existingDraft.fileNumber,
        title: existingDraft.title,
        deletedAt: new Date(),
        wasDraft: true
      }
    })

    return NextResponse.json({ message: 'Draft case deleted successfully' })
  } catch (error) {
    logger.error('Error deleting draft case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}