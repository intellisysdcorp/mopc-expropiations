import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sendRealtimeNotification } from '@/lib/websocket-server';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

const createNotificationSchema = z.object({
  type: z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'TASK_ASSIGNED', 'DEADLINE_REMINDER', 'STATUS_UPDATE', 'SYSTEM_ANNOUNCEMENT']),
  title: z.string().min(1, 'El título es requerido'),
  message: z.string().min(1, 'El mensaje es requerido'),
  recipientId: z.string().min(1, 'El ID del destinatario es requerido'),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).default('medium'),
  channels: z.array(z.string()).optional(),
  sendEmail: z.boolean().default(false),
  sendSms: z.boolean().default(false),
  sendPush: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  correlationId: z.string().optional(),
  batchId: z.string().optional()
});

// Get enhanced notifications for the current user
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
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: {
        notificationPreference: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build where clause
    const where: any = {
      userId: user.id
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

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          history: {
            where: {
              eventType: 'sent'
            },
            orderBy: {
              eventAt: 'desc'
            },
            take: 1
          },
          deliveries: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 3
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false
      }
    });

    // Get statistics
    const statistics = await getNotificationStatistics(user.id);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount,
      statistics,
      preferences: user.notificationPreference
    });

  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new enhanced notification
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

    // Check permissions
    const hasPermission = user.role.name === 'SUPER_ADMIN' ||
                         user.role.name === 'DEPARTMENT_ADMIN';

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify recipient exists and get preferences
    const recipient = await prisma.user.findUnique({
      where: { id: validatedData.recipientId },
      include: {
        notificationPreference: true,
        department: true
      }
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Process template if provided
    let processedContent = {
      title: validatedData.title,
      message: validatedData.message
    };

    if (validatedData.templateId) {
      const template = await prisma.notificationTemplate.findUnique({
        where: { id: validatedData.templateId }
      });

      if (template) {
        processedContent = processTemplate(template, validatedData.variables || {});
      }
    }

    // Check user preferences
    const shouldSend = await checkNotificationPreferences(
      recipient,
      validatedData.type,
      validatedData.priority,
      validatedData.channels
    );

    if (!shouldSend.shouldSend) {
      return NextResponse.json({
        success: false,
        message: 'Notification blocked by user preferences',
        reason: shouldSend.reason
      }, { status: 202 });
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        title: processedContent.title,
        message: processedContent.message,
        type: validatedData.type as any,
        priority: validatedData.priority,
        userId: validatedData.recipientId,
        channels: shouldSend.channels,
        sendEmail: shouldSend.channels.includes('email'),
        sendSms: shouldSend.channels.includes('sms'),
        sendPush: shouldSend.channels.includes('push'),
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        templateId: validatedData.templateId,
        variables: validatedData.variables,
        metadata: validatedData.metadata,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        correlationId: validatedData.correlationId || uuidv4(),
        batchId: validatedData.batchId
      },
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        template: true
      }
    });

    // Create history entry
    await prisma.notificationHistory.create({
      data: {
        notificationId: notification.id,
        eventType: 'created',
        status: 'success',
        eventAt: new Date(),
        userId: user.id,
        source: 'api',
        metadata: {
          createdBy: user.email,
          channels: shouldSend.channels,
          template: notification.template?.name
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
          priority: validatedData.priority,
          channels: shouldSend.channels
        }
      }
    });

    // Send real-time notification via WebSocket
    if (shouldSend.channels.includes('in_app')) {
      await sendRealtimeNotification({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        userId: notification.userId,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      });
    }

    // Create delivery records for each channel
    for (const channel of shouldSend.channels) {
      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          recipient: channel === 'email' ? recipient.email : recipient.id,
          recipientType: channel === 'email' ? 'email' : 'user_id',
          status: notification.scheduledAt ? 'pending' : 'processing',
          scheduledAt: notification.scheduledAt || new Date()
        }
      });
    }

    // Queue email if needed
    if (shouldSend.channels.includes('email')) {
      await queueEmailNotification(notification, recipient);
    }

    // Queue SMS if needed
    if (shouldSend.channels.includes('sms') && recipient.phone) {
      await queueSmsNotification(notification, recipient);
    }

    // Update template usage
    if (notification.templateId) {
      await prisma.notificationTemplate.update({
        where: { id: notification.templateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      success: true,
      notification: {
        ...notification,
        deliveries: null, // Exclude sensitive delivery info
        history: null
      }
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

// Helper functions
async function getNotificationStatistics(userId: string) {
  const [
    total,
    unread,
    byType,
    byPriority,
    recentActivity
  ] = await Promise.all([
    prisma.notification.count({
      where: { userId }
    }),
    prisma.notification.count({
      where: { userId, isRead: false }
    }),
    prisma.notification.groupBy({
      by: ['type'],
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _count: { type: true }
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _count: { priority: true }
    }),
    prisma.notificationHistory.findMany({
      where: {
        notification: { userId },
        eventAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { eventAt: 'desc' },
      take: 5,
      include: {
        notification: {
          select: { title: true, type: true }
        }
      }
    })
  ]);

  return {
    total,
    unread,
    read: total - unread,
    byType: byType.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {} as Record<string, number>),
    byPriority: byPriority.reduce((acc, stat) => {
      acc[stat.priority] = stat._count.priority;
      return acc;
    }, {} as Record<string, number>),
    recentActivity: recentActivity.map(activity => ({
      eventType: activity.eventType,
      timestamp: activity.eventAt,
      notification: {
        title: activity.notification.title,
        type: activity.notification.type
      }
    }))
  };
}

function processTemplate(template: any, variables: Record<string, any>) {
  let title = template.subject || template.content;
  let message = template.content;

  if (template.htmlContent) {
    message = template.htmlContent;
  }

  // Replace placeholders with variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    title = title.replace(new RegExp(placeholder, 'g'), String(value));
    message = message.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return { title, message };
}

async function checkNotificationPreferences(
  user: any,
  type: string,
  priority: string,
  requestedChannels?: string[]
): Promise<{ shouldSend: boolean; channels: string[]; reason?: string }> {
  const preferences = user.notificationPreference;

  // If no preferences, use defaults
  if (!preferences) {
    return {
      shouldSend: true,
      channels: requestedChannels || ['in_app']
    };
  }

  // Check quiet hours
  if (preferences.quietHoursEnabled) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    if (preferences.quietHoursStart && preferences.quietHoursEnd) {
      // Simple time range check (can be enhanced for overnight ranges)
      if (currentTime >= preferences.quietHoursStart && currentTime <= preferences.quietHoursEnd) {
        // Only allow urgent/critical notifications during quiet hours
        if (!['urgent', 'critical'].includes(priority)) {
          return {
            shouldSend: false,
            channels: [],
            reason: 'Quiet hours active'
          };
        }
      }
    }
  }

  // Check frequency limits
  const today = new Date().toISOString().split('T')[0];
  const todayNotifications = await prisma.notification.count({
    where: {
      userId: user.id,
      createdAt: {
        gte: new Date(today),
        lt: new Date(today + 'T23:59:59.999Z')
      }
    }
  });

  if (todayNotifications >= preferences.maxNotificationsPerDay) {
    return {
      shouldSend: false,
      channels: [],
      reason: 'Daily limit exceeded'
    };
  }

  // Determine channels based on preferences
  const channels: string[] = [];

  if (preferences.enableInAppNotifications && (!requestedChannels || requestedChannels.includes('in_app'))) {
    channels.push('in_app');
  }

  if (preferences.enableEmailNotifications && (!requestedChannels || requestedChannels.includes('email'))) {
    channels.push('email');
  }

  if (preferences.enableSmsNotifications && (!requestedChannels || requestedChannels.includes('sms'))) {
    channels.push('sms');
  }

  if (preferences.enablePushNotifications && (!requestedChannels || requestedChannels.includes('push'))) {
    channels.push('push');
  }

  return {
    shouldSend: channels.length > 0,
    channels
  };
}

async function queueEmailNotification(notification: any, recipient: any) {
  // Create email queue entry
  await prisma.emailQueue.create({
    data: {
      to: recipient.email,
      subject: notification.title,
      textContent: notification.message,
      htmlContent: generateHtmlEmail(notification),
      scheduledAt: notification.scheduledAt || new Date(),
      priority: notification.priority,
      templateId: notification.templateId,
      metadata: {
        notificationId: notification.id,
        userId: recipient.id
      },
      correlationId: notification.correlationId
    }
  });
}

async function queueSmsNotification(notification: any, recipient: any) {
  // SMS implementation would go here
  logger.info(`SMS notification queued for ${recipient.phone}: ${notification.title}`);
}

function generateHtmlEmail(notification: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 20px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .priority-${notification.priority} { border-left: 4px solid ${getPriorityColor(notification.priority)}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header priority-${notification.priority}">
          <h1>${notification.title}</h1>
        </div>
        <div class="content">
          <p>${notification.message}</p>
          ${notification.metadata ? generateMetadataHtml(notification.metadata) : ''}
        </div>
        <div class="footer">
          <p>Este es un mensaje automático del Sistema de Expropiación del MOPC.</p>
          <p>Si no solicitó esta notificación, por favor contacte al administrador del sistema.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
    case 'critical':
      return '#dc3545';
    case 'high':
      return '#fd7e14';
    case 'medium':
      return '#ffc107';
    default:
      return '#28a745';
  }
}

function generateMetadataHtml(metadata: any): string {
  if (!metadata || typeof metadata !== 'object') return '';

  let html = '<div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px;">';
  html += '<h3>Información Adicional:</h3>';

  Object.entries(metadata).forEach(([key, value]) => {
    if (key !== 'notificationId' && key !== 'userId') {
      html += `<p><strong>${key}:</strong> ${value}</p>`;
    }
  });

  html += '</div>';
  return html;
}