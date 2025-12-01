import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { UpdateUserNotificationPreference } from '@/types/notification';
import { defaultNotificationPreferences } from '@/types/notification';

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
        department: true,
        role: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return preferences or defaults
    const preferences = user.notificationPreference || defaultNotificationPreferences;

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
    const validatedData = validateUpdatePreferences(body);

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

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Validation error', details: error.message },
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
        ...defaultNotificationPreferences
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'UPDATED',
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

// Validation function for notification preferences
function validateUpdatePreferences(data: any): UpdateUserNotificationPreference {
  const validatedData: UpdateUserNotificationPreference = {};

  // Validate boolean fields
  if (data.enableEmailNotifications !== undefined) {
    validatedData.enableEmailNotifications = data.enableEmailNotifications;
  }

  if (data.enableSmsNotifications !== undefined) {
    validatedData.enableSmsNotifications = data.enableSmsNotifications;
  }

  if (data.enablePushNotifications !== undefined) {
    validatedData.enablePushNotifications = data.enablePushNotifications;
  }

  if (data.enableInAppNotifications !== undefined) {
    validatedData.enableInAppNotifications = data.enableInAppNotifications;
  }

  if (data.quietHoursEnabled !== undefined) {
    validatedData.quietHoursEnabled = data.quietHoursEnabled;
  }

  if (data.dailyDigestEnabled !== undefined) {
    validatedData.dailyDigestEnabled = data.dailyDigestEnabled;
  }

  if (data.weeklyDigestEnabled !== undefined) {
    validatedData.weeklyDigestEnabled = data.weeklyDigestEnabled;
  }

  if (data.mobileVibrationEnabled !== undefined) {
    validatedData.mobileVibrationEnabled = data.mobileVibrationEnabled;
  }

  if (data.mobileSoundEnabled !== undefined) {
    validatedData.mobileSoundEnabled = data.mobileSoundEnabled;
  }

  if (data.mobileBadgeEnabled !== undefined) {
    validatedData.mobileBadgeEnabled = data.mobileBadgeEnabled;
  }

  if (data.emailSignatureEnabled !== undefined) {
    validatedData.emailSignatureEnabled = data.emailSignatureEnabled;
  }

  // Validate string fields
  if (data.quietHoursStart !== undefined) {
    validatedData.quietHoursStart = data.quietHoursStart;
  }

  if (data.quietHoursEnd !== undefined) {
    validatedData.quietHoursEnd = data.quietHoursEnd;
  }

  if (data.timezone !== undefined) {
    validatedData.timezone = data.timezone;
  }

  if (data.emailFormatting !== undefined) {
    validatedData.emailFormatting = data.emailFormatting;
  }

  // Validate number fields
  if (data.maxNotificationsPerHour !== undefined) {
    validatedData.maxNotificationsPerHour = data.maxNotificationsPerHour;
  }

  if (data.maxNotificationsPerDay !== undefined) {
    validatedData.maxNotificationsPerDay = data.maxNotificationsPerDay;
  }

  // Validate object fields
  if (data.typePreferences !== undefined) {
    validatedData.typePreferences = data.typePreferences;
  }

  if (data.channelPreferences !== undefined) {
    validatedData.channelPreferences = data.channelPreferences;
  }

  if (data.departmentPreferences !== undefined) {
    validatedData.departmentPreferences = data.departmentPreferences;
  }

  if (data.priorityPreferences !== undefined) {
    validatedData.priorityPreferences = data.priorityPreferences;
  }

  if (data.customFilters !== undefined) {
    validatedData.customFilters = data.customFilters;
  }

  if (data.blockedSenders !== undefined) {
    validatedData.blockedSenders = data.blockedSenders;
  }

  if (data.allowedSenders !== undefined) {
    validatedData.allowedSenders = data.allowedSenders;
  }

  return validatedData;
}
