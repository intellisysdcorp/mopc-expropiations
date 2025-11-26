import type {
  Notification,
  NotificationType,
  NotificationTemplate,
  NotificationHistory,
  NotificationDelivery,
  Prisma
} from '@prisma/client';

/**
 * Type for creating a new notification. This is a subset of the Notification model
 * that only includes the fields needed for notification creation.
 * Excludes auto-generated fields like id, timestamps, and computed fields.
 */
export interface NotificationCreateData {
  // Core notification information
  title: string;
  message: string;
  type: NotificationType;
  priority?: string; // low, medium, high, urgent, critical

  // Read status
  isRead?: boolean;
  readAt?: Date | null;

  // Entity relationships
  entityType?: string | null; // case, meeting, document, user, department, workflow, etc.
  entityId?: string | null;

  // Delivery configuration
  channels?: Record<string, any> | null; // Delivery channels (in_app, email, sms, push, etc.)
  sendEmail?: boolean;
  emailSent?: boolean;
  sendSms?: boolean;
  smsSent?: boolean;
  sendPush?: boolean;
  pushSent?: boolean;

  // Scheduling and automation
  scheduledAt?: Date | null;
  expiresAt?: Date | null;

  // Content and personalization
  metadata?: Record<string, any> | null; // Additional notification data
  templateId?: string | null; // Template used for this notification
}

/**
 * Type for updating an existing notification. All fields are optional
 * to allow partial updates.
 */
export interface NotificationUpdateData {
  // Core notification information
  title?: string;
  message?: string;
  type?: NotificationType;
  priority?: string;

  // Read status
  isRead?: boolean;
  readAt?: Date | null;

  // Entity relationships
  entityType?: string | null;
  entityId?: string | null;

  // Delivery configuration
  channels?: Record<string, any> | null;
  sendEmail?: boolean;
  emailSent?: boolean;
  sendSms?: boolean;
  smsSent?: boolean;
  sendPush?: boolean;
  pushSent?: boolean;

  // Scheduling and automation
  scheduledAt?: Date | null;
  expiresAt?: Date | null;

  // Content and personalization
  metadata?: Record<string, any> | null;
  templateId?: string | null;
}

/**
 * Type for notification creation request body with additional fields
 * that are used in the API but not stored directly in the database.
 */
export interface CreateNotificationRequest {
  // Core notification information
  type: NotificationType;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'critical';

  // Recipient information
  recipientId: string;

  // Delivery configuration
  channels?: string[];
  sendEmail?: boolean;
  sendSms?: boolean;
  sendPush?: boolean;

  // Scheduling
  scheduledAt?: string; // ISO datetime string
  expiresAt?: string;   // ISO datetime string

  // Template and personalization
  templateId?: string;
  variables?: Record<string, any>;

  // Entity relationships
  entityType?: string;
  entityId?: string;

  // Tracking and correlation
  correlationId?: string;
  batchId?: string;

  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Type for notification filtering and querying
 */
export interface NotificationFilters {
  type?: string;
  isRead?: boolean;
  priority?: string;
  entityType?: string;
  entityId?: string;
  recipientId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  correlationId?: string;
  batchId?: string;
}

/**
 * Type for notification statistics and analytics
 */
export interface NotificationStats {
  total: number;
  unread: number;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
  clicked: number;
  byType: Array<{
    type: string;
    count: number;
  }>;
  byPriority: Array<{
    priority: string;
    count: number;
  }>;
  byChannel: Array<{
    channel: string;
    count: number;
  }>;
}

/**
 * Type for notification response with related data
 */
export interface NotificationWithRelations extends Notification {
  // Template information if available
  template?: NotificationTemplate;

  // Delivery information
  deliveries?: NotificationDelivery[];

  // History tracking
  history?: NotificationHistory[];

  // Computed fields
  _count?: {
    deliveries: number;
    history: number;
  };
}

/**
 * Type for notification delivery configuration
 */
export interface NotificationDeliveryConfig {
  channels: string[]; // ['in_app', 'email', 'sms', 'push']
  sendEmail: boolean;
  sendSms: boolean;
  sendPush: boolean;
  templateId?: string;
  variables?: Record<string, any>;
}

/**
 * Type for notification template variables
 */
export interface NotificationTemplateVariables {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'date' | 'object';
    required: boolean;
    default?: any;
    description?: string;
  };
}

/**
 * Type for notification creation response
 */
export interface NotificationCreateResponse {
  success: boolean;
  notification?: NotificationWithRelations;
  error?: string;
  deliveries?: Array<{
    channel: string;
    status: 'pending' | 'sent' | 'delivered' | 'failed';
    messageId?: string;
    error?: string;
  }>;
}

// TypeScript types based on Prisma UserNotificationPreference model
export interface UserNotificationPreference {
  id: string;
  userId: string;

  // Global preferences
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enablePushNotifications: boolean;
  enableInAppNotifications: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string | null; // HH:MM format
  quietHoursEnd: string | null; // HH:MM format
  timezone: string;

  // Frequency controls
  dailyDigestEnabled: boolean;
  weeklyDigestEnabled: boolean;
  maxNotificationsPerHour: number;
  maxNotificationsPerDay: number;

  // Type-specific preferences
  typePreferences: Record<string, any> | null; // Preferences by notification type

  // Channel preferences by type
  channelPreferences: Record<string, any> | null; // Channel preferences by notification type

  // Department preferences
  departmentPreferences: Record<string, any> | null; // Preferences by department

  // Priority preferences
  priorityPreferences: Record<string, any> | null; // Preferences by priority level

  // Custom filters
  customFilters: Record<string, any> | null; // Custom notification filters
  blockedSenders: Record<string, any> | null; // Blocked senders
  allowedSenders: Record<string, any> | null; // Whitelisted senders

  // Mobile preferences
  mobileVibrationEnabled: boolean;
  mobileSoundEnabled: boolean;
  mobileBadgeEnabled: boolean;

  // Email preferences
  emailFormatting: 'text' | 'html' | 'both';
  emailSignatureEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Type for updating notification preferences (all fields optional)
export type UpdateUserNotificationPreference = {
  enableEmailNotifications?: boolean;
  enableSmsNotifications?: boolean;
  enablePushNotifications?: boolean;
  enableInAppNotifications?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
  dailyDigestEnabled?: boolean;
  weeklyDigestEnabled?: boolean;
  maxNotificationsPerHour?: number;
  maxNotificationsPerDay?: number;
  typePreferences?: Prisma.InputJsonValue;
  channelPreferences?: Prisma.InputJsonValue;
  departmentPreferences?: Prisma.InputJsonValue;
  priorityPreferences?: Prisma.InputJsonValue;
  customFilters?: Prisma.InputJsonValue;
  blockedSenders?: Prisma.InputJsonValue;
  allowedSenders?: Prisma.InputJsonValue;
  mobileVibrationEnabled?: boolean;
  mobileSoundEnabled?: boolean;
  mobileBadgeEnabled?: boolean;
  emailFormatting?: 'text' | 'html' | 'both';
  emailSignatureEnabled?: boolean;
};

// Type for creating notification preferences (required fields only)
export type CreateUserNotificationPreference = Pick<UserNotificationPreference,
  'userId' |
  'enableEmailNotifications' |
  'enableSmsNotifications' |
  'enablePushNotifications' |
  'enableInAppNotifications' |
  'quietHoursEnabled' |
  'timezone' |
  'dailyDigestEnabled' |
  'weeklyDigestEnabled' |
  'maxNotificationsPerHour' |
  'maxNotificationsPerDay' |
  'mobileVibrationEnabled' |
  'mobileSoundEnabled' |
  'mobileBadgeEnabled' |
  'emailFormatting' |
  'emailSignatureEnabled'
> & {
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  typePreferences?: Record<string, any> | null;
  channelPreferences?: Record<string, any> | null;
  departmentPreferences?: Record<string, any> | null;
  priorityPreferences?: Record<string, any> | null;
  customFilters?: Record<string, any> | null;
  blockedSenders?: Record<string, any> | null;
  allowedSenders?: Record<string, any> | null;
};

// Default preferences object
export const defaultNotificationPreferences = {
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
  customFilters: {},
  blockedSenders: {},
  allowedSenders: {},
  mobileVibrationEnabled: true,
  mobileSoundEnabled: true,
  mobileBadgeEnabled: true,
  emailFormatting: 'both' as const,
  emailSignatureEnabled: true
} as const;

/**
 * Type for creating a new notification template
 */
export interface CreateNotificationTemplateRequest {
  name: string;
  description?: string;
  category: string;
  type: NotificationType;
  subject?: string;
  content: string;
  htmlContent?: string;
  variables?: Record<string, any>;
  placeholders?: Record<string, any>;
  defaultChannels?: string[];
  isActive: boolean;
  isDefault: boolean;
  language: string;
  translations?: Record<string, any>;
  requiredRole?: string;
  departmentId?: string;
}

/**
 * Type for notification template response
 */
export interface NotificationTemplateResponse {
  success: boolean;
  template?: NotificationTemplate;
  error?: string;
}

/**
 * Type for notification template statistics
 */
export interface NotificationTemplateStatistics {
  total: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byLanguage: Record<string, number>;
  mostUsed: Array<{
    id: string;
    name: string;
    usageCount: number;
    lastUsedAt: Date | null;
  }>;
}

/**
 * Type for updating an existing notification template
 */
export interface UpdateNotificationTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  type?: NotificationType;
  subject?: string;
  content?: string;
  htmlContent?: string;
  variables?: Record<string, any>;
  placeholders?: Record<string, any>;
  defaultChannels?: string[];
  isActive?: boolean;
  isDefault?: boolean;
  language?: string;
  translations?: Record<string, any>;
  requiredRole?: string;
  departmentId?: string;
}

/**
 * Type for notification template filters
 */
export interface NotificationTemplateFilters {
  category?: string;
  type?: string;
  isActive?: boolean;
  language?: string;
  search?: string;
  requiredRole?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

/**
 * Type for template variables and placeholders extraction
 */
export interface TemplateExtraction {
  variables: Record<string, NotificationTemplateVariables>;
  placeholders: Record<string, {
    description: string;
    example: string;
  }>;
}