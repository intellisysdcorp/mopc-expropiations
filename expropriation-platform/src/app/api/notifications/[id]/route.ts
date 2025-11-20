import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Get specific notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = (await params).id;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get notification
    const notification = await prisma.stageNotification.findFirst({
      where: {
        id: notificationId,
        recipientId: user.id
      },
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
            status: true,
            priority: true
          }
        }
      }
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(notification);

  } catch (error) {
    logger.error('Error fetching notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = (await params).id;
    const body = await request.json();

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get notification
    const notification = await prisma.stageNotification.findFirst({
      where: {
        id: notificationId,
        recipientId: user.id
      }
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Update notification
    const updatedNotification = await prisma.stageNotification.update({
      where: { id: notificationId },
      data: {
        isRead: body.isRead !== undefined ? body.isRead : true,
        readAt: body.isRead === false ? null : new Date()
      }
    });

    return NextResponse.json({
      success: true,
      notification: updatedNotification
    });

  } catch (error) {
    logger.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = (await params).id;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get notification
    const notification = await prisma.stageNotification.findFirst({
      where: {
        id: notificationId,
        recipientId: user.id
      }
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Delete notification
    await prisma.stageNotification.delete({
      where: { id: notificationId }
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}