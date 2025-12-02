import { prisma } from './prisma';
import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    email: string;
  };
}

export interface EmailJob {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  priority: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  metadata?: any;
}

class EmailQueueProcessor {
  private transporter: nodemailer.Transporter | null = null;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load email configuration from environment or database
      this.config = await this.loadEmailConfig();

      if (!this.config) {
        logger.warn('Email configuration not found. Email processing disabled.');
        return;
      }

      // Create nodemailer transporter
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify the transporter
      if (this.transporter) {
        await this.transporter.verify();
      }
      logger.info('Email transporter initialized successfully');

      // Start processing
      this.start();

    } catch (error) {
      logger.error('Failed to initialize email processor:', error);
    }
  }

  private async loadEmailConfig(): Promise<EmailConfig | null> {
    try {
      // Try to load from environment variables first
      const envConfig: EmailConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        },
        from: {
          name: process.env.SMTP_FROM_NAME || 'Sistema MOPC',
          email: process.env.SMTP_FROM_EMAIL || 'noreply@mopc.gov.do'
        }
      };

      if (envConfig.auth.user && envConfig.auth.pass) {
        return envConfig;
      }

      // If not in environment, try to load from database
      const dbConfig = await prisma.systemConfig.findFirst({
        where: {
          key: {
            in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email']
          }
        }
      });

      if (dbConfig) {
        const configs = await prisma.systemConfig.findMany({
          where: {
            key: {
              in: ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_from_email']
            }
          }
        });

        const configObj: any = {};
        configs.forEach(config => {
          configObj[config.key.replace('smtp_', '')] = config.value;
        });

        return {
          host: configObj.host || 'localhost',
          port: parseInt(configObj.port || '587'),
          secure: configObj.secure === 'true',
          auth: {
            user: configObj.user || '',
            pass: configObj.pass || ''
          },
          from: {
            name: configObj.from_name || 'Sistema MOPC',
            email: configObj.from_email || 'noreply@mopc.gov.do'
          }
        };
      }

      return null;

    } catch (error) {
      logger.error('Error loading email configuration:', error);
      return null;
    }
  }

  public start(): void {
    if (this.isProcessing || !this.transporter) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processEmailQueue();
    }, 30000); // Process every 30 seconds

    logger.info('Email queue processor started');
  }

  public stop(): void {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Email queue processor stopped');
  }

  private async processEmailQueue(): Promise<void> {
    try {
      if (!this.transporter) {
        return;
      }

      // Get pending emails with proper prioritization
      const pendingEmails = await prisma.emailQueue.findMany({
        where: {
          status: 'pending',
          scheduledAt: {
            lte: new Date()
          },
          OR: [
            { attempts: { lt: prisma.emailQueue.fields.maxAttempts } },
            { retryAfter: { lte: new Date() } }
          ]
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledAt: 'asc' },
          { attempts: 'asc' }
        ],
        take: 10 // Process in batches
      });

      if (pendingEmails.length === 0) {
        return;
      }

      logger.info(`Processing ${pendingEmails.length} emails`);

      // Process emails in parallel with a limit
      const batchSize = 5;
      for (let i = 0; i < pendingEmails.length; i += batchSize) {
        const batch = pendingEmails.slice(i, i + batchSize);
        await Promise.all(batch.map(email => this.sendEmail(email)));
      }

    } catch (error) {
      logger.error('Error processing email queue:', error);
    }
  }

  private async sendEmail(emailQueueItem: any): Promise<void> {
    try {
      // Update status to processing
      await prisma.emailQueue.update({
        where: { id: emailQueueItem.id },
        data: {
          status: 'processing',
          attempts: { increment: 1 }
        }
      });

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${emailQueueItem.fromName || this.config?.from.name}" <${emailQueueItem.fromEmail || this.config?.from.email}>`,
        to: emailQueueItem.to,
        subject: emailQueueItem.subject,
        text: emailQueueItem.textContent,
        html: emailQueueItem.htmlContent
      };

      // Add optional fields
      if (emailQueueItem.cc) mailOptions.cc = emailQueueItem.cc;
      if (emailQueueItem.bcc) mailOptions.bcc = emailQueueItem.bcc;
      if (emailQueueItem.replyTo) mailOptions.replyTo = emailQueueItem.replyTo;

      // Send email
      const result = await this.transporter!.sendMail(mailOptions);

      // Update status to sent
      await prisma.emailQueue.update({
        where: { id: emailQueueItem.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          messageId: result.messageId
        }
      });

      logger.info(`Email sent successfully: ${emailQueueItem.id} -> ${emailQueueItem.to}`);

    } catch (error) {
      logger.error(`Failed to send email ${emailQueueItem.id}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const attempts = emailQueueItem.attempts + 1;
      const maxAttempts = emailQueueItem.maxAttempts;

      // Calculate next retry time using exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, attempts), 24 * 60 * 60 * 1000); // Max 24 hours
      const retryAfter = new Date(Date.now() + retryDelay);

      if (attempts >= maxAttempts) {
        // Mark as failed
        await prisma.emailQueue.update({
          where: { id: emailQueueItem.id },
          data: {
            status: 'failed',
            failedAt: new Date(),
            error: errorMessage
          }
        });
      } else {
        // Schedule retry
        await prisma.emailQueue.update({
          where: { id: emailQueueItem.id },
          data: {
            status: 'pending',
            retryAfter,
            error: errorMessage
          }
        });
      }
    }
  }

  public async queueEmail(data: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    textContent?: string;
    htmlContent?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    priority?: string;
    scheduledAt?: Date;
    templateId?: string;
    metadata?: any;
    correlationId?: string;
    batchId?: string;
  }): Promise<string> {
    try {
      const baseEmailData = {
        to: data.to,
        subject: data.subject,
        priority: data.priority || 'medium',
        scheduledAt: data.scheduledAt || new Date(),
        provider: 'nodemailer' as const
      };

      const emailPayload: any = { ...baseEmailData };

      if (data.cc) emailPayload.cc = data.cc;
      if (data.bcc) emailPayload.bcc = data.bcc;
      if (data.textContent) emailPayload.textContent = data.textContent;
      if (data.htmlContent) emailPayload.htmlContent = data.htmlContent;
      if (data.fromName) emailPayload.fromName = data.fromName;
      if (data.fromEmail) emailPayload.fromEmail = data.fromEmail;
      if (data.replyTo) emailPayload.replyTo = data.replyTo;
      if (data.templateId) emailPayload.templateId = data.templateId;
      if (data.metadata) emailPayload.metadata = data.metadata;
      if (data.correlationId) emailPayload.correlationId = data.correlationId;
      if (data.batchId) emailPayload.batchId = data.batchId;

      const emailQueue = await prisma.emailQueue.create({
        data: emailPayload
      });

      return emailQueue.id;

    } catch (error) {
      logger.error('Error queuing email:', error);
      throw error;
    }
  }

  public async queueBulkEmails(emails: Array<{
    to: string;
    subject: string;
    textContent?: string;
    htmlContent?: string;
    metadata?: any;
  }>, options: {
    priority?: string;
    scheduledAt?: Date;
    batchId?: string;
  } = {}): Promise<string[]> {
    try {
      const batchId = options.batchId || `batch_${Date.now()}`;

      const emailQueues = await Promise.all(
        emails.map(email =>
          this.queueEmail({
            ...email,
            ...options,
            batchId
          })
        )
      );

      return emailQueues;

    } catch (error) {
      logger.error('Error queuing bulk emails:', error);
      throw error;
    }
  }

  public async getQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    todaySent: number;
    todayFailed: number;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      total,
      pending,
      processing,
      sent,
      failed,
      todaySent,
      todayFailed
    ] = await Promise.all([
      prisma.emailQueue.count(),
      prisma.emailQueue.count({ where: { status: 'pending' } }),
      prisma.emailQueue.count({ where: { status: 'processing' } }),
      prisma.emailQueue.count({ where: { status: 'sent' } }),
      prisma.emailQueue.count({ where: { status: 'failed' } }),
      prisma.emailQueue.count({
        where: {
          status: 'sent',
          sentAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        }
      }),
      prisma.emailQueue.count({
        where: {
          status: 'failed',
          failedAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        }
      })
    ]);

    return {
      total,
      pending,
      processing,
      sent,
      failed,
      todaySent,
      todayFailed
    };
  }

  public async retryFailedEmails(hoursBack: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const updated = await prisma.emailQueue.updateMany({
        where: {
          status: 'failed',
          failedAt: {
            gte: cutoffTime
          },
          attempts: {
            lt: prisma.emailQueue.fields.maxAttempts
          }
        },
        data: {
          status: 'pending',
          retryAfter: new Date()
        }
      });

      logger.info(`Retried ${updated.count} failed emails`);
      return updated.count;

    } catch (error) {
      logger.error('Error retrying failed emails:', error);
      throw error;
    }
  }

  public async cleanupOldEmails(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const deleted = await prisma.emailQueue.deleteMany({
        where: {
          status: {
            in: ['sent', 'failed']
          },
          OR: [
            { sentAt: { lt: cutoffDate } },
            { failedAt: { lt: cutoffDate } }
          ]
        }
      });

      logger.info(`Cleaned up ${deleted.count} old emails`);
      return deleted.count;

    } catch (error) {
      logger.error('Error cleaning up old emails:', error);
      throw error;
    }
  }

  public getStatus(): {
    isProcessing: boolean;
    hasTransporter: boolean;
    hasConfig: boolean;
    queueStats: any;
  } {
    return {
      isProcessing: this.isProcessing,
      hasTransporter: !!this.transporter,
      hasConfig: !!this.config,
      queueStats: null // Will be populated when needed
    };
  }
}

// Singleton instance
export const emailQueueProcessor = new EmailQueueProcessor();

// Export convenience functions
export const queueEmail = (data: Parameters<typeof emailQueueProcessor.queueEmail>[0]) =>
  emailQueueProcessor.queueEmail(data);

export const queueBulkEmails = (emails: Parameters<typeof emailQueueProcessor.queueBulkEmails>[0], options?: Parameters<typeof emailQueueProcessor.queueBulkEmails>[1]) =>
  emailQueueProcessor.queueBulkEmails(emails, options);

export const getQueueStats = () => emailQueueProcessor.getQueueStats();
export const retryFailedEmails = (hoursBack?: number) => emailQueueProcessor.retryFailedEmails(hoursBack);
export const cleanupOldEmails = (daysToKeep?: number) => emailQueueProcessor.cleanupOldEmails(daysToKeep);