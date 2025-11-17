import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createNotificationSchema = z.object({
  type: z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'TASK_ASSIGNED', 'DEADLINE_REMINDER', 'STATUS_UPDATE', 'SYSTEM_ANNOUNCEMENT']),
  title: z.string().min(1, 'El título es requerido'),
  message: z.string().min(1, 'El mensaje es requerido'),
  recipientId: z.string().min(1, 'El ID del destinatario es requerido'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  sendEmail: z.boolean().default(false),
  metadata: z.any().optional()
});

// Get notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const isRead = searchParams.get('isRead');
    const priority = searchParams.get('priority');
    const caseId = searchParams.get('caseId');

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build where clause
    const where: any = {
      recipientId: user.id
    };

    if (type) {
      where.type = type.toUpperCase();
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true';
    }

    if (priority) {
      where.priority = priority;
    }

    if (caseId) {
      where.caseId = caseId;
    }

    // Get notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.stageNotification.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              fileNumber: true,
              title: true,
              currentStage: true,
              status: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.stageNotification.count({ where })
    ]);

    // Get unread count
    const unreadCount = await prisma.stageNotification.count({
      where: {
        recipientId: user.id,
        isRead: false
      }
    });

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount,
      statistics: {
        total,
        unread: unreadCount,
        byType: await getNotificationStats(user.id)
      }
    });

  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new notification (admin function)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createNotificationSchema.parse(body);

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions (only admins can create notifications)
    const hasPermission = user.role.name === 'super_admin' ||
                         user.role.name === 'department_admin';

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: validatedData.recipientId }
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Create notification
    const notification = await prisma.stageNotification.create({
      data: {
        type: validatedData.type as any,
        title: validatedData.title,
        message: validatedData.message,
        recipientId: validatedData.recipientId,
        priority: validatedData.priority,
        sendEmail: validatedData.sendEmail,
        emailSent: false,
        metadata: validatedData.metadata
      },
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'CREATED',
        entityType: 'notification',
        entityId: notification.id,
        description: `Created notification: ${notification.title} for ${notification.recipient.firstName} ${notification.recipient.lastName}`,
        metadata: {
          notificationId: notification.id,
          recipientId: validatedData.recipientId,
          type: validatedData.type,
          priority: validatedData.priority
        }
      }
    });

    // TODO: Send email if requested
    if (validatedData.sendEmail) {
      // Implementation for email sending would go here
      logger.info(`Email notification would be sent to ${recipient.email}`);
    }

    return NextResponse.json({
      success: true,
      notification
    });

  } catch (error) {
    logger.error('Error creating notification:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get notification statistics
async function getNotificationStats(userId: string) {
  const stats = await prisma.stageNotification.groupBy({
    by: ['type'],
    where: {
      recipientId: userId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    _count: {
      type: true
    }
  });

  return stats.reduce((acc, stat) => {
    acc[stat.type.toLowerCase()] = stat._count.type;
    return acc;
  }, {} as Record<string, number>);
}