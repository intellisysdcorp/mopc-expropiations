import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-logger'
import { logger } from '@/lib/logger'
import { CreateCaseSchema, CaseSearchSchema } from '@/lib/validations/case'
import { type Prisma } from '@/prisma/client';

// GET /api/cases - List cases with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const searchParamsObject = Object.fromEntries(searchParams.entries())

    // Parse and validate search parameters
    const searchResult = CaseSearchSchema.safeParse(searchParamsObject)
    if (!searchResult.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: searchResult.error },
        { status: 400 }
      )
    }

    const {
      query,
      status,
      priority,
      currentStage,
      departmentId,
      assignedToId,
      createdBy,
      startDateFrom,
      startDateTo,
      expectedEndDateFrom,
      expectedEndDateTo,
      createdAtFrom,
      createdAtTo,
      ownerName,
      propertyAddress,
      fileNumber,
      page,
      limit,
      sortBy,
      sortOrder,
    } = searchResult.data

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true,
        department: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build where clause based on user permissions and filters
    const where: any = {
      deletedAt: null
    }

    // Apply filters
    if (query) {
      where.OR = [
        { fileNumber: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { ownerName: { contains: query, mode: 'insensitive' } },
        { propertyAddress: { contains: query, mode: 'insensitive' } }
      ]
    }

    if (status) {where.status = status}
    if (priority) {where.priority = priority}
    if (currentStage) {where.currentStage = currentStage}
    if (departmentId) {where.departmentId = departmentId}
    if (assignedToId) {where.assignedToId = assignedToId}
    if (createdBy) {where.createdById = createdBy}
    if (ownerName) {where.ownerName = { contains: ownerName, mode: 'insensitive' }}
    if (propertyAddress) {where.propertyAddress = { contains: propertyAddress, mode: 'insensitive' }}
    if (fileNumber) {where.fileNumber = { contains: fileNumber, mode: 'insensitive' }}

    // Date filters
    if (startDateFrom || startDateTo) {
      where.startDate = {}
      if (startDateFrom) {where.startDate.gte = startDateFrom}
      if (startDateTo) {where.startDate.lte = startDateTo}
    }

    if (expectedEndDateFrom || expectedEndDateTo) {
      where.expectedEndDate = {}
      if (expectedEndDateFrom) {where.expectedEndDate.gte = expectedEndDateFrom}
      if (expectedEndDateTo) {where.expectedEndDate.lte = expectedEndDateTo}
    }

    // Creation date filters
    if (createdAtFrom || createdAtTo) {
      where.createdAt = {}
      if (createdAtFrom) {where.createdAt.gte = createdAtFrom}
      if (createdAtTo) {where.createdAt.lte = createdAtTo}
    }

    // Apply department-based access control
    const role = user.role.name as string
    if (role !== 'SUPER_ADMIN') {
      // Non-super admins can only see cases from their department or assigned to them
      where.AND = [
        {
          OR: [
            { departmentId: user.departmentId },
            { assignedToId: user.id },
            { supervisedById: user.id },
            { createdById: user.id }
          ]
        }
      ]
    }

    // Count total records
    const total = await prisma.case.count({ where })

    // Get cases with pagination
    const cases = await prisma.case.findMany({
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
        _count: {
          select: {
            documents: true,
            histories: true,
            activities: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: (page - 1) * limit,
      take: limit
    })

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'VIEWED',
      entityType: 'case',
      entityId: 'list',
      description: `Viewed case list with filters`,
      metadata: {
        filters: searchResult.data,
        total,
        page,
        limit
      }
    })

    return NextResponse.json({
      cases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error fetching cases:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/cases - Create a new case
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestBody = await request.json()
    const validationResult = CreateCaseSchema.safeParse(requestBody)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error },
        { status: 400 }
      )
    }

    const caseData = validationResult.data

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to create cases
    const role = user.role.name.toUpperCase() as string
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ANALYST', 'SUPERVISOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create cases' },
        { status: 403 }
      )
    }

    // Check if file number already exists
    const existingCase = await prisma.case.findUnique({
      where: { fileNumber: caseData.fileNumber }
    })

    if (existingCase) {
      return NextResponse.json(
        { error: 'Case with this file number already exists' },
        { status: 409 }
      )
    }

    // Verify department exists and user has access
    const department = await prisma.department.findUnique({
      where: { id: caseData.departmentId }
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // If not super admin, ensure user belongs to the department
    if (role !== 'SUPER_ADMIN' && user.departmentId !== caseData.departmentId) {
      return NextResponse.json(
        { error: 'You can only create cases in your department' },
        { status: 403 }
      )
    }

    // Verify assigned user exists and belongs to same department (if provided)
    if (caseData.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: caseData.assignedToId }
      })

      if (!assignedUser) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        )
      }

      if (assignedUser.departmentId !== caseData.departmentId) {
        return NextResponse.json(
          { error: 'Assigned user must belong to the same department' },
          { status: 400 }
        )
      }
    }

    // Verify supervisor exists and has appropriate role (if provided)
    if (caseData.supervisedById) {
      const supervisor = await prisma.user.findUnique({
        where: { id: caseData.supervisedById },
        include: { role: true }
      })

      if (!supervisor) {
        return NextResponse.json(
          { error: 'Supervisor not found' },
          { status: 404 }
        )
      }

      if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR'].includes(supervisor.role.name as string)) {
        return NextResponse.json(
          { error: 'Supervisor must have admin or supervisor role' },
          { status: 400 }
        )
      }
    }

    // Create the case payload with required fields
    const casePayload: Prisma.CaseUncheckedCreateInput = {
      ...caseData,
      createdById: user.id,
      startDate: caseData.startDate || new Date(),
      // Convert undefined to null for optional fields that Prisma expects as nullable
      description: caseData.description ?? null,
      propertyDescription: caseData.propertyDescription ?? null,
      propertyCoordinates: caseData.propertyCoordinates ?? null,
      propertyArea: caseData.propertyArea ?? null,
      propertyType: caseData.propertyType ?? null,
      ownerIdentification: caseData.ownerIdentification ?? null,
      ownerContact: caseData.ownerContact ?? null,
      ownerEmail: caseData.ownerEmail ?? null,
      ownerAddress: caseData.ownerAddress ?? null,
      ownerType: caseData.ownerType ?? null,
      estimatedValue: caseData.estimatedValue ?? null,
      actualValue: caseData.actualValue ?? null,
      appraisalValue: caseData.appraisalValue ?? null,
      compensationAmount: caseData.compensationAmount ?? null,
      currency: caseData.currency ?? null,
      expropriationDecree: caseData.expropriationDecree ?? null,
      judicialCaseNumber: caseData.judicialCaseNumber ?? null,
      legalStatus: caseData.legalStatus ?? null,
      assignedToId: caseData.assignedToId ?? null,
      supervisedById: caseData.supervisedById ?? null,
      expectedEndDate: caseData.expectedEndDate ?? null
    }

    // Create the case
    const newCase = await prisma.case.create({
      data: casePayload,
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
    logger.info(newCase);

    // Log case creation
    await logActivity({
      userId: user.id,
      action: 'CREATED',
      entityType: 'case',
      entityId: newCase.id,
      description: `Created case ${newCase.fileNumber}: ${newCase.title}`,
      metadata: {
        caseId: newCase.id,
        fileNumber: newCase.fileNumber,
        title: newCase.title,
        departmentId: newCase.departmentId
      }
    })

    // Create case history entry
    await prisma.caseHistory.create({
      data: {
        caseId: newCase.id,
        changedById: user.id,
        action: 'case_created',
        newValue: JSON.stringify({
          fileNumber: newCase.fileNumber,
          title: newCase.title,
          status: newCase.status,
          stage: newCase.currentStage,
          department: newCase.department?.name
        }),
        notes: 'Caso creado inicialmente'
      }
    })

    return NextResponse.json(newCase, { status: 201 })
  } catch (error) {
    logger.error('Error creating case:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}