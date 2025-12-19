import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { URLParams } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await auth()
    const key = (await params).key

    if (!key) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    // Only allow super admins to access configuration history
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Find the configuration first
    const config = await prisma.systemConfiguration.findFirst({
      where: {
        key
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Get history for this configuration
    const history = await prisma.systemConfigurationHistory.findMany({
      where: {
        configurationId: config.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        changer: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.systemConfigurationHistory.count({
      where: {
        configurationId: config.id
      }
    })

    return NextResponse.json({
      history,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    logger.error('Error fetching configuration history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}