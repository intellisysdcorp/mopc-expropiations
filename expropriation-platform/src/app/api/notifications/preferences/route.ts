import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const updatePreferencesSchema = z.object({
  enableEmailNotifications: z.boolean().optional(),
  enableSmsNotifications: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  enableInAppNotifications: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  timezone: z.string().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  maxNotificationsPerHour: z.number().int().min(1).max(1000).optional(),
  maxNotificationsPerDay: z.number().int().min(1).max(10000).optional(),
  typePreferences: z.record(z.any()).optional(),
  channelPreferences: z.record(z.any()).optional(),
  departmentPreferences: z.record(z.any()).optional(),
  priorityPreferences: z.record(z.any()).optional(),
  customFilters: z.record(z.any()).optional(),
  blockedSenders: z.array(z.string()).optional(),
  allowedSenders: z.array(z.string()).optional(),
  mobileVibrationEnabled: z.boolean().optional(),
  mobileSoundEnabled: z.boolean().optional(),
  mobileBadgeEnabled: z.boolean().optional(),
  emailFormatting: z.enum(['text', 'html', 'both']).optional(),
  emailSignatureEnabled: z.boolean().optional()
});

// Get user notification preferences
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: {
        notificationPreference: true,
        department: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return preferences or defaults
    const preferences = user.notificationPreference || {
      enableEmailNotifications: true,
      enableSmsNotifications: false,
      enablePushNotifications: true,
      enableInAppNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: 'America/Santo_Domingo',
      dailyDigestEnabled: false,
      weeklyDigestEnabled: false,
      maxNotificationsPerHour: 50,
      maxNotificationsPerDay: 200,
      typePreferences: {},
      channelPreferences: {},
      departmentPreferences: {},
      priorityPreferences: {},
      customFilters: [],
      blockedSenders: [],
      allowedSenders: [],
      mobileVibrationEnabled: true,
      mobileSoundEnabled: true,
      mobileBadgeEnabled: true,
      emailFormatting: 'both',
      emailSignatureEnabled: true
    };

    return NextResponse.json({
      preferences,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department?.name,
        role: user.role?.name
      }
    });

  } catch (error) {
    logger.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update user notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = updatePreferencesSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upsert preferences
    const preferences = await prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      update: validatedData,
      create: {
        userId: user.id,
        ...validatedData
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'UPDATED',
        entityType: 'notification_preferences',
        entityId: preferences.id,
        description: 'Updated notification preferences',
        metadata: {
          updatedFields: Object.keys(validatedData)
        }
      }
    });

    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error) {
    logger.error('Error updating notification preferences:', error);

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

// Reset preferences to defaults
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete existing preferences
    await prisma.userNotificationPreference.deleteMany({
      where: { userId: user.id }
    });

    // Create default preferences
    const defaultPreferences = await prisma.userNotificationPreference.create({
      data: {
        userId: user.id,
        enableEmailNotifications: true,
        enableSmsNotifications: false,
        enablePushNotifications: true,
        enableInAppNotifications: true,
        quietHoursEnabled: false,
        timezone: 'America/Santo_Domingo',
        dailyDigestEnabled: false,
        weeklyDigestEnabled: false,
        maxNotificationsPerHour: 50,
        maxNotificationsPerDay: 200,
        mobileVibrationEnabled: true,
        mobileSoundEnabled: true,
        mobileBadgeEnabled: true,
        emailFormatting: 'both',
        emailSignatureEnabled: true
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'RESET',
        entityType: 'notification_preferences',
        entityId: defaultPreferences.id,
        description: 'Reset notification preferences to defaults'
      }
    });

    return NextResponse.json({
      success: true,
      preferences: defaultPreferences
    });

  } catch (error) {
    logger.error('Error resetting notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}