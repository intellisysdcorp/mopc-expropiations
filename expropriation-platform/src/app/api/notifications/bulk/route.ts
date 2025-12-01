import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const bulkActionSchema = z.object({
  action: z.enum(['mark_read', 'mark_unread', 'delete']),
  notificationIds: z.array(z.string()).min(1, 'At least one notification ID is required')
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = bulkActionSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify all notifications belong to the user
    const notifications = await prisma.stageNotification.findMany({
      where: {
        id: { in: validatedData.notificationIds },
        recipientId: user.id
      }
    });

    if (notifications.length === 0) {
      return NextResponse.json({ error: 'No valid notifications found' }, { status: 404 });
    }

    const validNotificationIds = notifications.map(n => n.id);

    // Perform bulk action
    let result;
    switch (validatedData.action) {
      case 'mark_read':
        result = await prisma.stageNotification.updateMany({
          where: {
            id: { in: validNotificationIds },
            recipientId: user.id
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
        break;

      case 'mark_unread':
        result = await prisma.stageNotification.updateMany({
          where: {
            id: { in: validNotificationIds },
            recipientId: user.id
          },
          data: {
            isRead: false,
            readAt: null
          }
        });
        break;

      case 'delete':
        result = await prisma.stageNotification.deleteMany({
          where: {
            id: { in: validNotificationIds },
            recipientId: user.id
          }
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'UPDATED',
        entityType: 'notifications_bulk',
        entityId: 'bulk',
        description: `Bulk ${validatedData.action} on ${result.count} notifications`,
        metadata: {
          action: validatedData.action,
          count: result.count,
          notificationIds: validNotificationIds
        }
      }
    });

    return NextResponse.json({
      success: true,
      action: validatedData.action,
      affectedCount: result.count,
      message: `Successfully ${validatedData.action.replace('_', ' ')} ${result.count} notification(s)`
    });

  } catch (error) {
    logger.error('Error performing bulk notification action:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}