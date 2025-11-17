import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/cases/count-today - Get count of cases created today
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has permission to create cases (required for this functionality)
    const role = user.role.name.toUpperCase() as string
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ANALYST', 'SUPERVISOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get today's date range (start of day to end of day)
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Build where clause based on user permissions
    const where: any = {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay
      },
      deletedAt: null
    }

    // Apply department-based access control
    if (role !== 'SUPER_ADMIN') {
      // Non-super admins only see cases from their department
      where.departmentId = user.departmentId
    }

    // Count cases created today
    const count = await prisma.case.count({ where })

    return NextResponse.json({ count })
  } catch (error) {
    logger.error('Error getting today\'s case count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}