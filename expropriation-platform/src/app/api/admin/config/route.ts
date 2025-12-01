import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { type Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Only allow super admins to access system configurations
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const environment = searchParams.get('environment')

    const where: {
      category?: string;
      environment?: string;
    } = {}
    if (category && category !== 'all') {
      where.category = category
    }
    if (environment && environment !== 'all') {
      where.environment = environment
    }

    const configs = await prisma.systemConfiguration.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ],
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        updater: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(configs)
  } catch (error) {
    logger.error('Error fetching system configurations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Only allow super admins to create system configurations
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Check if configuration already exists for this key and environment
    const existingConfig = await prisma.systemConfiguration.findFirst({
      where: {
        key: body.key,
        environment: body.environment || 'production'
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: 'Configuration with this key already exists for this environment' },
        { status: 409 }
      )
    }

    const systemConfigCreatePayload: Prisma.SystemConfigurationUncheckedCreateInput = {
      ...body,
      environment: body.environment || 'production',
      effectiveAt: new Date(),
      createdBy: session.user.id
    };

    const config = await prisma.systemConfiguration.create({
      data: systemConfigCreatePayload,
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Create history entry
    await prisma.systemConfigurationHistory.create({
      data: {
        configurationId: config.id,
        key: config.key,
        oldValue: 'null',
        newValue: JSON.stringify(config.value),
        type: config.type,
        category: config.category,
        changeReason: 'Initial configuration created',
        changedBy: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json(config, { status: 201 })
  } catch (error) {
    logger.error('Error creating system configuration:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}