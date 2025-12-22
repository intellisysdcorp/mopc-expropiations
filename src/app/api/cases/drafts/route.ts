import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'

// Generate a unique draft file number
function generateDraftFileNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `DRAFT-${year}-${month}-${day}-${random}`
}

// POST /api/cases/drafts - Create a draft case (NO VALIDATION)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // For drafts, we bypass all validation and apply minimal transformation
    const draftData: any = {
      ...body,
      isDraft: true,
      // Provide default values for required fields only if not provided
      fileNumber: body.fileNumber || generateDraftFileNumber(),
      title: body.title || 'Borrador sin título',
      propertyAddress: body.propertyAddress || 'Dirección pendiente',
      propertyCity: body.propertyCity || 'Ciudad pendiente',
      propertyProvince: body.propertyProvince || 'Provincia pendiente',
      ownerName: body.ownerName || 'Propietario pendiente',
      currency: body.currency || 'DOP',
      // Fix enum values to match database schema
      priority: body.priority || 'MEDIUM',
      currentStage: body.currentStage || 'AVALUO',
      status: body.status || 'PENDIENTE',
      // Handle "UNASSIGNED" values properly
      assignedToId: body.assignedToId === 'UNASSIGNED' ? null : body.assignedToId,
      supervisedById: body.supervisedById === 'UNASSIGNED' ? null : body.supervisedById
    }

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true, department: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to create cases
    const role = user.role.name.toUpperCase() as string
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ANALYST', 'SUPERVISOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create draft cases' },
        { status: 403 }
      )
    }

    // Check if file number already exists (if provided)
    if (draftData.fileNumber && !draftData.fileNumber.startsWith('DRAFT-')) {
      const existingCase = await prisma.case.findUnique({
        where: { fileNumber: draftData.fileNumber }
      })

      if (existingCase) {
        return NextResponse.json(
          { error: 'Case with this file number already exists' },
          { status: 409 }
        )
      }
    }

    // Set department if not provided
    if (!draftData.departmentId) {
      if (user.departmentId) {
        draftData.departmentId = user.departmentId
      } else {
        return NextResponse.json(
          { error: 'Department is required for draft creation' },
          { status: 400 }
        )
      }
    }

    // Verify department exists and user has access
    const department = await prisma.department.findUnique({
      where: { id: draftData.departmentId }
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // If not super admin, ensure user belongs to the department
    if (role !== 'SUPER_ADMIN' && user.departmentId !== draftData.departmentId) {
      return NextResponse.json(
        { error: 'You can only create draft cases in your department' },
        { status: 403 }
      )
    }

    // Create the draft case
    const newDraft = await prisma.case.create({
      data: {
        ...draftData,
        createdById: user.id,
        startDate: new Date()
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

    // Log draft creation
    await logActivity({
      userId: user.id,
      action: 'CREATED',
      entityType: 'case',
      entityId: newDraft.id,
      description: `Created draft case ${newDraft.fileNumber}: ${newDraft.title}`,
      metadata: {
        caseId: newDraft.id,
        fileNumber: newDraft.fileNumber,
        title: newDraft.title,
        departmentId: newDraft.departmentId,
        isDraft: true
      }
    })

    // Create case history entry
    await prisma.caseHistory.create({
      data: {
        caseId: newDraft.id,
        changedById: user.id,
        action: 'draft_created',
        newValue: JSON.stringify({
          fileNumber: newDraft.fileNumber,
          title: newDraft.title,
          isDraft: true,
          department: newDraft.department.name
        }),
        notes: 'Borrador de caso creado'
      }
    })

    return NextResponse.json(newDraft, { status: 201 })
  } catch (error) {
    logger.error('Error creating draft case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/cases/drafts - List draft cases
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build where clause for draft cases
    const where: any = {
      deletedAt: null,
      isDraft: true
    }

    // Apply department-based access control
    const role = user.role.name.toUpperCase() as string
    if (role !== 'SUPER_ADMIN') {
      // Non-super admins can only see drafts from their department or created by them
      where.AND = [
        {
          OR: [
            { departmentId: user.departmentId },
            { createdById: user.id }
          ]
        }
      ]
    }

    // Count total draft records
    const total = await prisma.case.count({ where })

    // Get draft cases with pagination
    const drafts = await prisma.case.findMany({
      where,
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
        _count: {
          select: {
            documents: true,
            histories: true,
            activities: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'VIEWED',
      entityType: 'case',
      entityId: 'draft-list',
      description: `Viewed draft case list`,
      metadata: {
        total,
        page,
        limit
      }
    })

    return NextResponse.json({
      drafts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error fetching draft cases:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}