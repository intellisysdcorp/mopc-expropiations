import { prisma } from './prisma';
import { sendRealtimeNotification } from './websocket-server';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export interface ReminderConfig {
  id: string;
  type: 'deadline' | 'follow_up' | 'escalation' | 'maintenance' | 'daily_digest' | 'weekly_summary';
  name: string;
  description: string;
  schedule: string; // Cron expression
  isActive: boolean;
  conditions: {
    entityType: 'case' | 'task' | 'meeting' | 'document' | 'user';
    filters: Record<string, any>;
    timeBefore?: number; // Minutes/hours/days before
    timeAfter?: number; // Minutes/hours/days after
  };
  templateId: string | null;
  recipients: {
    type: 'entity_owner' | 'department_head' | 'role_based' | 'custom';
    value?: string;
    customEmails?: string[];
  };
  channels: string[];
  metadata?: Record<string, any>;
}

export interface ReminderJob {
  id: string;
  configId: string;
  scheduledAt: Date;
  executedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  entityId: string | null;
  entityType: 'case' | 'task' | 'meeting' | 'document' | 'user' | null;
  error?: string;
  result?: any;
}

class NotificationReminderSystem {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private jobs: Map<string, ReminderJob> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load existing pending jobs from database
    await this.loadPendingJobs();

    // Start the reminder processor
    this.start();

    logger.info('Notification Reminder System initialized');
  }

  private async loadPendingJobs(): Promise<void> {
    try {
      const pendingJobs = await prisma.reminderJob.findMany({
        where: {
          status: 'pending',
          scheduledAt: {
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
          }
        },
        include: {
          config: true
        },
        orderBy: {
          scheduledAt: 'asc'
        }
      });

      pendingJobs.forEach(job => {
        this.jobs.set(job.id, job as ReminderJob);
      });

      logger.info(`Loaded ${pendingJobs.length} pending reminder jobs`);
    } catch (error) {
      logger.error('Error loading pending reminder jobs:', error);
    }
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Reminder system is already running');
      return;
    }

    this.isRunning = true;
    this.interval = setInterval(() => {
      this.processReminders();
    }, 60000); // Check every minute

    logger.info('Reminder system started');
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info('Reminder system stopped');
  }

  private async processReminders(): Promise<void> {
    try {
      const now = new Date();
      const jobsToExecute = Array.from(this.jobs.values()).filter(
        job => job.status === 'pending' && job.scheduledAt <= now
      );

      if (jobsToExecute.length === 0) {
        return;
      }

      logger.info(`Processing ${jobsToExecute.length} reminder jobs`);

      // Process jobs in parallel with a limit
      const batchSize = 5;
      for (let i = 0; i < jobsToExecute.length; i += batchSize) {
        const batch = jobsToExecute.slice(i, i + batchSize);
        await Promise.all(batch.map(job => this.executeReminderJob(job)));
      }

    } catch (error) {
      logger.error('Error processing reminders:', error);
    }
  }

  private async executeReminderJob(job: ReminderJob): Promise<void> {
    try {
      // Update job status to running
      await this.updateJobStatus(job.id, 'running');

      // Load config with template
      const config = await this.getReminderConfig(job.configId);
      if (!config) {
        throw new Error(`Reminder config not found: ${job.configId}`);
      }

      // Get entities that match the conditions
      const entities = await this.getMatchingEntities(config);

      if (entities.length === 0) {
        await this.updateJobStatus(job.id, 'completed', {
          result: { message: 'No matching entities found' }
        });
        return;
      }

      // Process each entity
      const results = [];
      for (const entity of entities) {
        try {
          const result = await this.sendReminder(config, entity);
          results.push({ entityId: entity.id, success: true, result });
        } catch (error) {
          logger.error(`Error sending reminder for entity ${entity.id}:`, error);
          results.push({
            entityId: entity.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update job status to completed
      await this.updateJobStatus(job.id, 'completed', {
        result: { entitiesProcessed: results.length, results }
      });

      // Remove job from memory
      this.jobs.delete(job.id);

    } catch (error) {
      logger.error(`Error executing reminder job ${job.id}:`, error);

      await this.updateJobStatus(job.id, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date()
      });
    }
  }

  private async getReminderConfig(configId: string): Promise<ReminderConfig | null> {
    try {
      const config = await prisma.reminderConfig.findUnique({
        where: { id: configId },
        include: {
          template: true
        }
      });

      if (!config) {
        return null;
      }

      return {
        id: config.id,
        type: config.type as any,
        name: config.name,
        description: config.description,
        schedule: config.schedule,
        isActive: config.isActive,
        conditions: config.conditions as any,
        templateId: config.templateId || null,
        recipients: config.recipients as any,
        channels: config.channels as string[],
        metadata: config.metadata as any
      };
    } catch (error) {
      logger.error('Error loading reminder config:', error);
      return null;
    }
  }

  private async getMatchingEntities(config: ReminderConfig): Promise<any[]> {
    try {
      const { entityType, filters, timeBefore, timeAfter } = config.conditions;

      let entities: any[] = [];

      switch (entityType) {
        case 'case':
          entities = await this.getMatchingCases(filters, timeBefore, timeAfter);
          break;
        case 'task':
          entities = await this.getMatchingTasks(filters, timeBefore, timeAfter);
          break;
        case 'meeting':
          entities = await this.getMatchingMeetings(filters, timeBefore, timeAfter);
          break;
        case 'document':
          entities = await this.getMatchingDocuments(filters, timeBefore, timeAfter);
          break;
        case 'user':
          entities = await this.getMatchingUsers(filters, timeBefore, timeAfter);
          break;
        default:
          logger.warn(`Unknown entity type: ${entityType}`);
      }

      return entities;
    } catch (error) {
      logger.error('Error getting matching entities:', error);
      return [];
    }
  }

  private async getMatchingCases(filters: Record<string, any>, timeBefore?: number, timeAfter?: number): Promise<any[]> {
    const where: any = {};

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.currentStage) {
      where.currentStage = filters.currentStage;
    }
    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    // Apply time-based conditions
    const now = new Date();
    if (timeBefore && filters.dateField) {
      const targetDate = new Date(now.getTime() + timeBefore * 60 * 1000);
      where[filters.dateField] = {
        lte: targetDate
      };
    }
    if (timeAfter && filters.dateField) {
      const targetDate = new Date(now.getTime() - timeAfter * 60 * 1000);
      where[filters.dateField] = {
        gte: targetDate
      };
    }

    return await prisma.case.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        supervisedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            headUserId: true
          }
        }
      }
    });
  }

  private async getMatchingTasks(_filters: Record<string, any>, _timeBefore?: number, _timeAfter?: number): Promise<any[]> {
    // Similar implementation for tasks
    // This would depend on your task management system
    return [];
  }

  private async getMatchingMeetings(filters: Record<string, any>, timeBefore?: number, _timeAfter?: number): Promise<any[]> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.meetingType) {
      where.meetingType = filters.meetingType;
    }

    // Time-based conditions for meetings
    const now = new Date();
    if (timeBefore) {
      const targetTime = new Date(now.getTime() + timeBefore * 60 * 1000);
      where.scheduledStart = {
        lte: targetTime,
        gte: now
      };
    }

    return await prisma.meeting.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });
  }

  private async getMatchingDocuments(_filters: Record<string, any>, _timeBefore?: number, _timeAfter?: number): Promise<any[]> {
    // Similar implementation for documents
    return [];
  }

  private async getMatchingUsers(_filters: Record<string, any>, _timeBefore?: number, _timeAfter?: number): Promise<any[]> {
    // Similar implementation for users
    return [];
  }

  private async sendReminder(config: ReminderConfig, entity: any): Promise<any> {
    // Get recipients
    const recipients = await this.getRecipients(config, entity);

    if (recipients.length === 0) {
      return { message: 'No recipients found' };
    }

    // Process template if available
    let title = config.name;
    let message = config.description;

    if (config.templateId) {
      const template = await prisma.notificationTemplate.findUnique({
        where: { id: config.templateId }
      });

      if (template) {
        const variables = this.extractVariablesFromEntity(entity);
        const processed = this.processTemplate(template, variables);
        title = processed.title;
        message = processed.message;
      }
    }

    // Send notifications to all recipients
    const results = [];
    for (const recipient of recipients) {
      try {
        const notification = await prisma.notification.create({
          data: {
            title,
            message,
            type: 'DEADLINE_REMINDER',
            priority: 'medium',
            userId: recipient.id,
            channels: config.channels,
            sendEmail: config.channels.includes('email'),
            sendPush: config.channels.includes('push'),
            entityType: config.conditions.entityType,
            entityId: entity.id,
            metadata: {
              reminderConfigId: config.id,
              reminderType: config.type,
              entityData: entity
            }
          }
        });

        // Send real-time notification
        if (config.channels.includes('in_app')) {
          await sendRealtimeNotification({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: (notification.type as any).toLowerCase(),
            priority: notification.priority as 'low' | 'medium' | 'high' | 'urgent',
            userId: notification.userId,
            metadata: (notification.metadata as any) || {},
            createdAt: notification.createdAt
          });
        }

        // Queue email if needed
        if (config.channels.includes('email')) {
          await this.queueEmailNotification(notification, recipient);
        }

        results.push({ recipientId: recipient.id, success: true, notificationId: notification.id });
      } catch (error) {
        logger.error(`Error sending reminder to ${recipient.id}:`, error);
        results.push({
          recipientId: recipient.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { recipientsProcessed: results.length, results };
  }

  private async getRecipients(config: ReminderConfig, entity: any): Promise<any[]> {
    const recipients: any[] = [];

    switch (config.recipients.type) {
      case 'entity_owner':
        if (entity.assignedTo) {
          recipients.push(entity.assignedTo);
        }
        if (entity.createdBy) {
          recipients.push(entity.createdBy);
        }
        break;

      case 'department_head':
        if (entity.department?.headUserId) {
          const headUser = await prisma.user.findUnique({
            where: { id: entity.department.headUserId }
          });
          if (headUser) {
            recipients.push(headUser);
          }
        }
        break;

      case 'role_based':
        if (config.recipients.value) {
          const roleUsers = await prisma.user.findMany({
            where: {
              role: { name: config.recipients.value },
              isActive: true
            }
          });
          recipients.push(...roleUsers);
        }
        break;

      case 'custom':
        if (config.recipients.customEmails) {
          const customUsers = await prisma.user.findMany({
            where: {
              email: { in: config.recipients.customEmails },
              isActive: true
            }
          });
          recipients.push(...customUsers);
        }
        break;
    }

    return recipients;
  }

  private extractVariablesFromEntity(entity: any): Record<string, any> {
    const variables: Record<string, any> = {
      ...entity,
      entity
    };

    // Add common variables
    variables.currentDate = new Date().toLocaleDateString();
    variables.currentTime = new Date().toLocaleTimeString();

    return variables;
  }

  private processTemplate(template: any, variables: Record<string, any>): { title: string; message: string } {
    let title = template.subject || template.content;
    let message = template.content;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value));
      message = message.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return { title, message };
  }

  private async queueEmailNotification(notification: any, recipient: any): Promise<void> {
    await prisma.emailQueue.create({
      data: {
        to: recipient.email,
        subject: notification.title,
        textContent: notification.message,
        htmlContent: this.generateHtmlEmail(notification),
        priority: notification.priority,
        templateId: notification.templateId,
        metadata: {
          notificationId: notification.id,
          userId: recipient.id,
          reminderNotification: true
        }
      }
    });
  }

  private generateHtmlEmail(notification: any): string {
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
          .reminder { border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header reminder">
            <h1>📅 Recordatorio Automático</h1>
            <h2>${notification.title}</h2>
          </div>
          <div class="content">
            <p>${notification.message}</p>
            ${notification.metadata?.reminderType ? `
              <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                <strong>Tipo de Recordatorio:</strong> ${notification.metadata.reminderType}
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>Este es un recordatorio automático del Sistema de Expropiación del MOPC.</p>
            <p>Si no deseas recibir estos recordatorios, por favor ajusta tus preferencias de notificación.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async updateJobStatus(
    jobId: string,
    status: 'running' | 'completed' | 'failed',
    data?: { result?: any; error?: string; failedAt?: Date }
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (status === 'running') {
        updateData.executedAt = new Date();
      }

      if (data) {
        Object.assign(updateData, data);
      }

      await prisma.reminderJob.update({
        where: { id: jobId },
        data: updateData
      });

      // Update in-memory job
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = status;
        if (data?.result) job.result = data.result;
        if (data?.error) job.error = data.error;
      }
    } catch (error) {
      logger.error(`Error updating job status for ${jobId}:`, error);
    }
  }

  public async scheduleReminder(config: ReminderConfig, entityId?: string): Promise<string> {
    const jobId = uuidv4();

    // Calculate next execution time based on config
    const scheduledAt = this.calculateNextExecution(config);

    const job: ReminderJob = {
      id: jobId,
      configId: config.id,
      scheduledAt,
      status: 'pending',
      entityId: entityId || null,
      entityType: config.conditions.entityType || null
    };

    // Save to database
    await prisma.reminderJob.create({
      data: {
        id: jobId,
        configId: config.id,
        scheduledAt,
        status: 'pending',
        entityId: entityId || null,
        entityType: config.conditions.entityType || null
      }
    });

    // Add to memory
    this.jobs.set(jobId, job);

    return jobId;
  }

  private calculateNextExecution(config: ReminderConfig): Date {
    // Simple implementation - in production, use a proper cron parser
    const now = new Date();

    // For deadline reminders, calculate based on entity
    if (config.type === 'deadline' && config.conditions.timeBefore) {
      return new Date(now.getTime() + config.conditions.timeBefore * 60 * 1000);
    }

    // Default to 1 hour from now for other types
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  public async cancelReminder(jobId: string): Promise<boolean> {
    try {
      await prisma.reminderJob.update({
        where: { id: jobId },
        data: { status: 'cancelled' }
      });

      this.jobs.delete(jobId);
      return true;
    } catch (error) {
      logger.error(`Error cancelling reminder job ${jobId}:`, error);
      return false;
    }
  }

  public getPendingJobsCount(): number {
    return Array.from(this.jobs.values()).filter(job => job.status === 'pending').length;
  }

  public getRunningJobsCount(): number {
    return Array.from(this.jobs.values()).filter(job => job.status === 'running').length;
  }
}

// Singleton instance
export const reminderSystem = new NotificationReminderSystem();

// Export convenience functions
export const scheduleReminder = (config: ReminderConfig, entityId?: string) =>
  reminderSystem.scheduleReminder(config, entityId);

export const cancelReminder = (jobId: string) =>
  reminderSystem.cancelReminder(jobId);

export const startReminderSystem = () => reminderSystem.start();
export const stopReminderSystem = () => reminderSystem.stop();