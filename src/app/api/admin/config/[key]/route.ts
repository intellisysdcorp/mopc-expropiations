import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { URLParams } from '@/types'

const updateConfigSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
  changeReason: z.string().optional()
})

export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await auth()
    const key = (await params).key

    // Only allow super admins to access system configurations
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const config = await prisma.systemConfiguration.findFirst({
      where: {
        key
      },
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

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    logger.error('Error fetching system configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: URLParams 
) {
  try {
    const session = await auth()
    const key = (await params).key

    // Only allow super admins to update system configurations
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = updateConfigSchema.parse(body)

    const existingConfig = await prisma.systemConfiguration.findFirst({
      where: {
        key
      }
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Store old value for history
    const oldValue = existingConfig.value

    // Update configuration
    const updateData: any = {
      value: validatedData.value as any,
      version: existingConfig.version + 1,
      previousValue: oldValue as any,
      updatedBy: session.user.id,
      updatedAt: new Date()
    }

    // Only include description if it's provided
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }

    const updatedConfig = await prisma.systemConfiguration.update({
      where: {
        id: existingConfig.id
      },
      data: updateData,
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

    // Create history entry
    await prisma.systemConfigurationHistory.create({
      data: {
        configurationId: updatedConfig.id,
        key: updatedConfig.key,
        oldValue: oldValue as any,
        newValue: validatedData.value as any,
        type: updatedConfig.type,
        category: updatedConfig.category,
        changeReason: validatedData.changeReason || 'Configuration updated',
        changedBy: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      }
    })

    return NextResponse.json(updatedConfig)
  } catch (error) {
    logger.error('Error updating system configuration:', error)
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

export async function DELETE(
  _request: NextRequest,
  { params }: URLParams 
) {
  try {
    const session = await auth()
    const key = (await params).key

    // Only allow super admins to delete system configurations
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const existingConfig = await prisma.systemConfiguration.findFirst({
      where: {
        key
      }
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Check if configuration is required
    if (existingConfig.isRequired) {
      return NextResponse.json(
        { error: 'Cannot delete required configuration' },
        { status: 400 }
      )
    }

    // Delete configuration (this will cascade delete history due to foreign key constraint)
    await prisma.systemConfiguration.delete({
      where: {
        id: existingConfig.id
      }
    })

    return NextResponse.json({
      message: 'Configuration deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting system configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}