import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  DocumentType,
  DocumentCategory,
  DocumentStatus,
  DocumentSecurityLevel,
} from '@prisma/client';
import { logger } from '@/lib/logger';

// Advanced search validation schema
const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filters: z.object({
    documentTypes: z.array(z.nativeEnum(DocumentType)).optional(),
    categories: z.array(z.nativeEnum(DocumentCategory)).optional(),
    statuses: z.array(z.nativeEnum(DocumentStatus)).optional(),
    securityLevels: z.array(z.nativeEnum(DocumentSecurityLevel)).optional(),
    tags: z.array(z.string()).optional(),
    uploadedBy: z.array(z.string()).optional(),
    caseIds: z.array(z.string()).optional(),
    dateRange: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    sizeRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    hasVersions: z.boolean().optional(),
    hasSignatures: z.boolean().optional(),
    isExpired: z.boolean().optional(),
  }).optional(),
  sort: z.object({
    field: z.enum([
      'relevance',
      'createdAt',
      'updatedAt',
      'title',
      'fileSize',
      'downloadCount',
      'viewCount',
    ]).default('relevance'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }).optional(),
  includeContent: z.boolean().default(false),
});

// POST /api/documents/search - Advanced document search
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = searchSchema.parse(body);

    const {
      query,
      filters = {},
      sort = { field: 'relevance', order: 'desc' },
      pagination = { page: 1, limit: 20 },
      includeContent,
    } = validatedData;

    // Build search conditions
    const where: any = {
      OR: [
        // Search in title
        { title: { contains: query } },
        // Search in description
        { description: { contains: query } },
        // Search in filename
        { fileName: { contains: query } },
        // Search in content (full-text search)
        { contentText: { contains: query } },
        // Search in tags
        { tags: { contains: query } },
      ],
    };

    // Apply filters
    if (filters.documentTypes && filters.documentTypes.length > 0) {
      where.documentType = { in: filters.documentTypes };
    }

    if (filters.categories && filters.categories.length > 0) {
      where.category = { in: filters.categories };
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    if (filters.securityLevels && filters.securityLevels.length > 0) {
      where.securityLevel = { in: filters.securityLevels };
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tagsRelations = {
        some: {
          tag: { in: filters.tags },
          isActive: true,
        },
      };
    }

    if (filters.uploadedBy && filters.uploadedBy.length > 0) {
      where.uploadedById = { in: filters.uploadedBy };
    }

    if (filters.caseIds && filters.caseIds.length > 0) {
      where.caseId = { in: filters.caseIds };
    }

    if (filters.dateRange) {
      where.createdAt = {};
      if (filters.dateRange.from) {
        where.createdAt.gte = new Date(filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        where.createdAt.lte = new Date(filters.dateRange.to);
      }
    }

    if (filters.sizeRange) {
      where.fileSize = {};
      if (filters.sizeRange.min) {
        where.fileSize.gte = filters.sizeRange.min;
      }
      if (filters.sizeRange.max) {
        where.fileSize.lte = filters.sizeRange.max;
      }
    }

    if (filters.hasVersions !== undefined) {
      if (filters.hasVersions) {
        where.versions = {
          some: {},
        };
      } else {
        where.versions = {
          none: {},
        };
      }
    }

    if (filters.hasSignatures !== undefined) {
      if (filters.hasSignatures) {
        where.signatures = {
          some: {},
        };
      } else {
        where.signatures = {
          none: {},
        };
      }
    }

    if (filters.isExpired !== undefined) {
      if (filters.isExpired) {
        where.expiresAt = {
          lt: new Date(),
        };
      } else {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ];
      }
    }

    // Exclude archived documents unless specifically requested
    if (!filters.statuses?.includes(DocumentStatus.ARCHIVED)) {
      where.status = { not: DocumentStatus.ARCHIVED };
    }

    // Get total count
    const total = await prisma.document.count({ where });

    // Build sort options
    let orderBy: any = {};
    if (sort.field === 'relevance') {
      // For relevance, we'll sort by creation date as a fallback
      // In a real implementation, you might want to use a full-text search engine
      orderBy = { createdAt: sort.order === 'desc' ? 'desc' : 'asc' };
    } else {
      orderBy = { [sort.field]: sort.order };
    }

    // Get search results
    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
        tagsRelations: {
          select: {
            id: true,
            tag: true,
            color: true,
          },
        },
        _count: {
          select: {
            versions: true,
            signatures: true,
            history: true,
            actions: true,
          },
        },
      },
      orderBy,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    // Calculate relevance scores (simple implementation)
    const documentsWithScores = documents.map(doc => {
      let score = 0;
      const queryLower = query.toLowerCase();

      // Title match (highest weight)
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Description match
      if (doc.description?.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Filename match
      if (doc.fileName.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      // Content match
      if (doc.contentText?.toLowerCase().includes(queryLower)) {
        score += 2;
      }

      // Tags match
      if (doc.tags?.toLowerCase().includes(queryLower)) {
        score += 4;
      }

      // Exact matches get bonus points
      if (doc.title.toLowerCase() === queryLower) score += 20;
      if (doc.fileName.toLowerCase() === queryLower) score += 15;

      return {
        ...doc,
        relevanceScore: score,
      };
    });

    // Sort by relevance if requested
    if (sort.field === 'relevance') {
      documentsWithScores.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        return sort.order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    // Format results
    const formattedResults = documentsWithScores.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      fileSize: doc.fileSize,
      fileSizeFormatted: formatFileSize(doc.fileSize),
      mimeType: doc.mimeType,
      documentType: doc.documentType,
      category: doc.category,
      status: doc.status,
      securityLevel: doc.securityLevel,
      version: doc.version,
      isLatest: doc.isLatest,
      isPublic: doc.isPublic,
      downloadCount: doc.downloadCount,
      viewCount: doc.viewCount,
      tags: doc.tagsRelations.map(tag => ({
        id: tag.id,
        tag: tag.tag,
        color: tag.color,
      })),
      uploadedBy: {
        id: doc.uploadedBy.id,
        firstName: doc.uploadedBy.firstName,
        lastName: doc.uploadedBy.lastName,
        fullName: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
        email: doc.uploadedBy.email,
      },
      case: doc.case,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      expiresAt: doc.expiresAt?.toISOString(),
      relevanceScore: doc.relevanceScore,
      stats: {
        versions: doc._count.versions,
        signatures: doc._count.signatures,
        history: doc._count.history,
        actions: doc._count.actions,
      },
      // Include content snippet if requested
      ...(includeContent && doc.contentText && {
        contentSnippet: getContentSnippet(doc.contentText, query),
      }),
    }));

    // Get search suggestions/facets
    const facets = await getSearchFacets(query, filters);

    return NextResponse.json({
      results: formattedResults,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
      search: {
        query,
        filters,
        sort,
        facets,
      },
    });
  } catch (error) {
    logger.error('Error searching documents:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to search documents' },
      { status: 500 }
    );
  }
}

// GET /api/documents/search/suggestions - Get search suggestions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Get suggestions from various sources
    const suggestions = await Promise.all([
      // Title suggestions
      getTitleSuggestions(query, limit),
      // Tag suggestions
      getTagSuggestions(query, limit),
      // Category suggestions
      getCategorySuggestions(query),
      // User suggestions (uploaded by)
      getUserSuggestions(query, limit),
    ]);

    // Combine and deduplicate suggestions
    const allSuggestions = suggestions.flat().filter(Boolean);
    const uniqueSuggestions = Array.from(new Set(allSuggestions)).slice(0, limit);

    return NextResponse.json({
      suggestions: uniqueSuggestions,
    });
  } catch (error) {
    logger.error('Error getting search suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get search suggestions' },
      { status: 500 }
    );
  }
}

// Helper functions

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getContentSnippet(content: string, query: string, maxLength: number = 200): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const index = contentLower.indexOf(queryLower);

  if (index === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 150);
  const snippet = content.substring(start, end);

  // Highlight the query in the snippet
  const highlighted = snippet.replace(
    new RegExp(query, 'gi'),
    (match) => `**${match}**`
  );

  return (start > 0 ? '...' : '') + highlighted + (end < content.length ? '...' : '');
}

async function getTitleSuggestions(query: string, limit: number): Promise<string[]> {
  const documents = await prisma.document.findMany({
    where: {
      title: { contains: query },
      status: { not: 'ARCHIVED' },
    },
    select: { title: true },
    take: limit,
    orderBy: { downloadCount: 'desc' },
  });

  return documents.map(doc => doc.title);
}

async function getTagSuggestions(query: string, limit: number): Promise<string[]> {
  const tags = await prisma.documentTag.findMany({
    where: {
      tag: { contains: query },
      isActive: true,
    },
    select: { tag: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return tags.map(tag => tag.tag);
}

async function getCategorySuggestions(query: string): Promise<string[]> {
  const categories = Object.values(DocumentCategory);
  return categories.filter(cat =>
    cat.toLowerCase().includes(query.toLowerCase())
  );
}

async function getUserSuggestions(query: string, limit: number): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { email: { contains: query } },
      ],
      isActive: true,
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
    take: limit,
    orderBy: { lastName: 'asc' },
  });

  return users.map(user => `${user.firstName} ${user.lastName} (${user.email})`);
}

async function getSearchFacets(query: string, filters: any): Promise<any> {
  const facets: any = {};

  // Document type facets
  const typeFacets = await prisma.document.groupBy({
    by: ['documentType'],
    where: {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { contentText: { contains: query } },
      ],
      ...(filters.documentTypes && { documentType: { in: filters.documentTypes } }),
      ...(filters.categories && { category: { in: filters.categories } }),
      ...(filters.statuses && { status: { in: filters.statuses } }),
    },
    _count: true,
  });

  facets.documentTypes = typeFacets.map(facet => ({
    value: facet.documentType,
    count: facet._count,
  }));

  // Category facets
  const categoryFacets = await prisma.document.groupBy({
    by: ['category'],
    where: {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { contentText: { contains: query } },
      ],
      ...(filters.documentTypes && { documentType: { in: filters.documentTypes } }),
      ...(filters.categories && { category: { in: filters.categories } }),
      ...(filters.statuses && { status: { in: filters.statuses } }),
    },
    _count: true,
  });

  facets.categories = categoryFacets.map(facet => ({
    value: facet.category,
    count: facet._count,
  }));

  // Status facets
  const statusFacets = await prisma.document.groupBy({
    by: ['status'],
    where: {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { contentText: { contains: query } },
      ],
      ...(filters.documentTypes && { documentType: { in: filters.documentTypes } }),
      ...(filters.categories && { category: { in: filters.categories } }),
    },
    _count: true,
  });

  facets.statuses = statusFacets.map(facet => ({
    value: facet.status,
    count: facet._count,
  }));

  return facets;
}