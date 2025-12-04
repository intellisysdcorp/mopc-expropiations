import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['all', 'case', 'document', 'user', 'department']).default('all'),
});

interface SearchResult {
  id: string;
  type: 'case' | 'document' | 'user' | 'department';
  title: string;
  description?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  url: string;
  relevance: number;
}

function calculateRelevance(query: string, title: string, description?: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const descLower = description?.toLowerCase() || '';

  let relevance = 0;

  // Exact title match
  if (titleLower === queryLower) relevance += 1.0;
  // Title starts with query
  else if (titleLower.startsWith(queryLower)) relevance += 0.8;
  // Title contains query
  else if (titleLower.includes(queryLower)) relevance += 0.6;
  // Description contains query
  else if (descLower.includes(queryLower)) relevance += 0.3;

  // Bonus for word matches
  const queryWords = queryLower.split(' ');
  const titleWords = titleLower.split(' ');
  const descWords = descLower.split(' ');

  queryWords.forEach(qWord => {
    if (titleWords.some(tWord => tWord === qWord)) relevance += 0.2;
    if (descWords.some(dWord => dWord === qWord)) relevance += 0.1;
  });

  return Math.min(relevance, 1.0);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = searchSchema.parse({
      q: searchParams.get('q'),
      limit: searchParams.get('limit'),
      type: searchParams.get('type'),
    });

    const results: SearchResult[] = [];
    const query = params.q.toLowerCase();

    // Search Cases
    if (params.type === 'all' || params.type === 'case') {
      const cases = await prisma.case.findMany({
        where: {
          AND: [
            // Department-based access control
            session.user.role === 'SUPER_ADMIN' ? {} : {
              OR: [
                {
                  assignments: {
                    some: {
                      userId: session.user.id
                    }
                  }
                }
              ]
            },
            {
              OR: [
                { fileNumber: { contains: query } },
                { title: { contains: query } },
                { description: { contains: query } },
                { propertyAddress: { contains: query } },
                { ownerName: { contains: query } },
                { ownerEmail: { contains: query } },
              ]
            }
          ]
        },
        include: {
          assignments: {
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
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        take: params.limit,
      });

      cases.forEach(case_ => {
        const assignedUser = case_.assignments.find((assignment: any) => assignment.user?.id)?.user || case_.assignedTo;
        const relevance = calculateRelevance(
          params.q,
          case_.title,
          `${case_.description} ${case_.fileNumber} ${case_.propertyAddress} ${case_.ownerName}`
        );

        if (relevance > 0.1) {
          results.push({
            id: case_.id,
            type: 'case',
            title: `${case_.fileNumber} - ${case_.title}`,
            description: case_.description || `${case_.propertyAddress} • ${case_.ownerName}`,
            metadata: {
              status: case_.status,
              priority: case_.priority,
              stage: case_.currentStage,
              assignedTo: assignedUser?.firstName && assignedUser?.lastName
                ? `${assignedUser.firstName} ${assignedUser.lastName}`.trim()
                : assignedUser?.email || 'Unassigned',
              createdAt: case_.createdAt.toISOString(),
            },
            url: `/cases/${case_.id}`,
            relevance,
          });
        }
      });
    }

    // Search Documents
    if (params.type === 'all' || params.type === 'document') {
      const documents = await prisma.document.findMany({
        where: {
          AND: [
            // Department-based access control
            session.user.role === 'SUPER_ADMIN' ? {} : {
              uploadedById: session.user.id
            },
            {
              OR: [
                { fileName: { contains: query } },
                { originalFileName: { contains: query } },
                { description: { contains: query } },
                { title: { contains: query } },
                { tags: { contains: query } },
              ]
            }
          ]
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        take: params.limit,
      });

      documents.forEach(doc => {
        const relevance = calculateRelevance(
          params.q,
          doc.originalFileName || doc.fileName,
          doc.description || ''
        );

        if (relevance > 0.1) {
          results.push({
            id: doc.id,
            type: 'document',
            title: doc.originalFileName || doc.fileName,
            description: doc.description || `Documento: ${doc.title}`,
            metadata: {
              documentType: doc.documentType,
              category: doc.category,
              status: doc.status,
              securityLevel: doc.securityLevel,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              uploadedBy: doc.uploadedBy?.firstName && doc.uploadedBy?.lastName
                ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim()
                : doc.uploadedBy?.email || 'Unknown',
              uploadedAt: doc.createdAt.toISOString(),
            },
            url: `/documents/${doc.id}`,
            relevance,
          });
        }
      });
    }

    // Search Users
    if (params.type === 'all' || params.type === 'user') {
      // Only allow admins to search users
      if (['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role)) {
        const users = await prisma.user.findMany({
          where: {
            AND: [
              // Department-based access control for department admins
              session.user.role === 'SUPER_ADMIN' ? {} : {
                id: session.user.id // Only return current user for non-super-admin
              },
              {
                OR: [
                  { firstName: { contains: query } },
                  { lastName: { contains: query } },
                  { email: { contains: query } },
                  { username: { contains: query } },
                ]
              }
            ]
          },
          take: params.limit,
        });

        users.forEach(user => {
          const relevance = calculateRelevance(
            params.q,
            `${user.firstName} ${user.lastName}`,
            `${user.email} ${user.username || ''}`
          );

          if (relevance > 0.1) {
            results.push({
              id: user.id,
              type: 'user',
              title: `${user.firstName} ${user.lastName}`.trim(),
              description: `${user.email}`,
              metadata: {
                email: user.email,
                username: user.username,
                phone: user.phone,
                isActive: user.isActive,
                isSuspended: user.isSuspended,
                lastLoginAt: user.lastLoginAt?.toISOString(),
                createdAt: user.createdAt.toISOString(),
              },
              url: `/users/${user.id}`,
              relevance,
            });
          }
        });
      }
    }

    // Search Departments
    if (params.type === 'all' || params.type === 'department') {
      // Only allow admins to search departments
      if (['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role)) {
        const departments = await prisma.department.findMany({
          where: {
            AND: [
              // Department-based access control
              session.user.role === 'SUPER_ADMIN' ? {} : {
                OR: [
                  { id: session.user.departmentId },
                  { parentId: session.user.departmentId }
                ]
              },
              {
                OR: [
                  { name: { contains: query } },
                  { description: { contains: query } },
                  { code: { contains: query } },
                ]
              }
            ]
          },
          take: params.limit,
        });

        departments.forEach(dept => {
          const relevance = calculateRelevance(
            params.q,
            dept.name,
            dept.description || ''
          );

          if (relevance > 0.1) {
            results.push({
              id: dept.id,
              type: 'department',
              title: dept.name,
              description: dept.description || `Departamento ${dept.code}`,
              metadata: {
                code: dept.code,
                email: dept.email,
                isActive: dept.isActive,
                createdAt: dept.createdAt.toISOString(),
                updatedAt: dept.updatedAt.toISOString(),
              },
              url: `/departments/${dept.id}`,
              relevance,
            });
          }
        });
      }
    }

    // Sort by relevance and limit results
    const sortedResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, params.limit);

    const response = {
      results: sortedResults,
      total: results.length,
      took: Date.now(),
      query: params.q,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Search error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}