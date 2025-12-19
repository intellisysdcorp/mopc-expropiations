import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DocumentActionType } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

const documentActionEnum = Object.values(DocumentActionType) as [string, ...string[]];

// Validation schema
const queryHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  action: z.enum(documentActionEnum).optional(),
  userId: z.string().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  sortBy: z.enum(['createdAt', 'action', 'userId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeDetails: z.boolean().default(true),
});

// GET /api/documents/[id]/history - Get document history/audit trail
export async function GET(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = queryHistorySchema.parse(Object.fromEntries(searchParams));

    // Check if document exists and user has permission
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions (simplified - in real implementation, check role-based permissions)
    const hasPermission =
      document.uploadedById === session.user.id ||
      document.isPublic;

    if (!hasPermission) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build where clause
    const where: any = { documentId: id };

    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;

    // Date range filtering
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    // Get total count
    const total = await prisma.documentHistory.count({ where });

    // Get history entries
    const historyEntries = await prisma.documentHistory.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    // Format history entries
    const formattedHistory = historyEntries.map(entry => ({
      ...entry,
      user: {
        ...entry.user,
        fullName: `${entry.user.firstName} ${entry.user.lastName}`,
      },
      actionDescription: getActionDescription(entry.action),
      actionCategory: getActionCategory(entry.action),
      createdAt: entry.createdAt.toISOString(),
      // Parse JSON fields if includeDetails is true
      ...(query.includeDetails && {
        previousValue: entry.previousValue ? JSON.parse(entry.previousValue as string) : null,
        newValue: entry.newValue ? JSON.parse(entry.newValue as string) : null,
        metadata: entry.metadata ? JSON.parse(entry.metadata as string) : null,
      }),
    }));

    // Get statistics
    const statistics = await getHistoryStatistics(id);

    // Get timeline data
    const timeline = await getHistoryTimeline(id);

    return NextResponse.json({
      documentId: id,
      documentTitle: document.title,
      history: formattedHistory,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
      statistics,
      timeline,
      filters: {
        action: query.action,
        userId: query.userId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    });
  } catch (error) {
    logger.error('Error fetching document history:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch document history' },
      { status: 500 }
    );
  }
}

// POST /api/documents/[id]/history - Export document history
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { format = 'json', includeDetails = true, filters = {} } = body;

    // Check if document exists and user has permission
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.uploadedById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all history entries
    const where: any = { documentId: id };
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const historyEntries = await prisma.documentHistory.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format for export
    const exportData = {
      exportInfo: {
        documentId: id,
        documentTitle: document.title,
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.id,
        format,
        totalEntries: historyEntries.length,
        filters,
      },
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.originalFileName,
        fileSize: document.fileSize,
        documentType: document.documentType,
        category: document.category,
        status: document.status,
        uploadedBy: {
          id: document.uploadedBy.id,
          fullName: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
          email: document.uploadedBy.email,
        },
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      history: historyEntries.map(entry => ({
        ...entry,
        user: {
          ...entry.user,
          fullName: `${entry.user.firstName} ${entry.user.lastName}`,
        },
        actionDescription: getActionDescription(entry.action),
        actionCategory: getActionCategory(entry.action),
        createdAt: entry.createdAt.toISOString(),
        ...(includeDetails && {
          previousValue: entry.previousValue ? JSON.parse(entry.previousValue as string) : null,
          newValue: entry.newValue ? JSON.parse(entry.newValue as string) : null,
          metadata: entry.metadata ? JSON.parse(entry.metadata as string) : null,
        }),
      })),
      statistics: await getHistoryStatistics(id),
    };

    if (format === 'json') {
      return NextResponse.json(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="document-history-${id}.json"`,
        },
      });
    } else if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(historyEntries, includeDetails);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="document-history-${id}.csv"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Error exporting document history:', error);
    return NextResponse.json(
      { error: 'Failed to export document history' },
      { status: 500 }
    );
  }
}

// Helper functions

function getActionDescription(action: DocumentActionType): string {
  const descriptions: { [key in DocumentActionType]: string } = {
    UPLOADED: 'Document uploaded',
    DOWNLOADED: 'Document downloaded',
    VIEWED: 'Document viewed',
    EDITED: 'Document edited',
    DELETED: 'Document deleted',
    ARCHIVED: 'Document archived',
    RESTORED: 'Document restored',
    SHARED: 'Document shared',
    SIGNED: 'Document signed',
    APPROVED: 'Document approved',
    REJECTED: 'Document rejected',
    VERSIONED: 'New version created',
    COPIED: 'Document copied',
    MOVED: 'Document moved',
    TAGGED: 'Tags updated',
    CATEGORIZED: 'Category updated',
  };

  return descriptions[action] || action;
}

function getActionCategory(action: DocumentActionType): string {
  const categories: { [key in DocumentActionType]: string } = {
    UPLOADED: 'File Management',
    DOWNLOADED: 'File Management',
    VIEWED: 'Access',
    EDITED: 'Content',
    DELETED: 'File Management',
    ARCHIVED: 'File Management',
    RESTORED: 'File Management',
    SHARED: 'Collaboration',
    SIGNED: 'Approval',
    APPROVED: 'Approval',
    REJECTED: 'Approval',
    VERSIONED: 'Version Control',
    COPIED: 'File Management',
    MOVED: 'File Management',
    TAGGED: 'Metadata',
    CATEGORIZED: 'Metadata',
  };

  return categories[action] || 'Other';
}

async function getHistoryStatistics(documentId: string): Promise<any> {
  const [
    actionStats,
    userStats,
    dailyStats,
    fieldChangeStats
  ] = await Promise.all([
    // Statistics by action type
    prisma.documentHistory.groupBy({
      by: ['action'],
      where: { documentId },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
    }),
    // Statistics by user
    prisma.documentHistory.groupBy({
      by: ['userId'],
      where: { documentId },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
    // Daily statistics for last 30 days
    prisma.$queryRaw`
      SELECT
        DATE(createdAt) as date,
        COUNT(*) as count
      FROM document_histories
      WHERE documentId = ${documentId}
        AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
    `,
    // Field change statistics
    prisma.documentHistory.groupBy({
      by: ['field'],
      where: {
        documentId,
        field: { not: null },
      },
      _count: true,
      orderBy: { _count: { field: 'desc' } },
    }),
  ]);

  // Get user details for user stats
  const userIds = userStats.map(stat => stat.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  const userMap = users.reduce((map, user) => {
    map[user.id] = `${user.firstName} ${user.lastName}`;
    return map;
  }, {} as Record<string, string>);

  return {
    byAction: actionStats.map(stat => ({
      action: stat.action,
      count: stat._count,
      description: getActionDescription(stat.action),
      category: getActionCategory(stat.action),
    })),
    byUser: userStats.map(stat => ({
      userId: stat.userId,
      userName: userMap[stat.userId] || 'Unknown User',
      count: stat._count,
    })),
    byDay: dailyStats,
    byField: fieldChangeStats.filter(stat => stat.field !== null),
  };
}

async function getHistoryTimeline(documentId: string): Promise<any> {
  const timeline = await prisma.documentHistory.findMany({
    where: { documentId },
    select: {
      id: true,
      action: true,
      createdAt: true,
      userId: true,
      field: true,
      changeReason: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return timeline.map(entry => ({
    id: entry.id,
    action: entry.action,
    actionDescription: getActionDescription(entry.action),
    timestamp: entry.createdAt.toISOString(),
    user: {
      id: entry.userId,
      name: `${entry.user.firstName} ${entry.user.lastName}`,
    },
    field: entry.field,
    changeReason: entry.changeReason,
  }));
}

function convertToCSV(entries: any[], includeDetails: boolean): string {
  const headers = [
    'ID',
    'Action',
    'Description',
    'User',
    'User Email',
    'Timestamp',
    'IP Address',
    'Field',
    'Change Reason',
    ...(includeDetails ? ['Previous Value', 'New Value', 'Metadata'] : []),
  ];

  const rows = entries.map(entry => [
    entry.id,
    entry.action,
    getActionDescription(entry.action),
    entry.user.fullName,
    entry.user.email,
    entry.createdAt,
    entry.ipAddress || '',
    entry.field || '',
    entry.changeReason || '',
    ...(includeDetails ? [
      entry.previousValue || '',
      entry.newValue || '',
      entry.metadata || '',
    ] : []),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}