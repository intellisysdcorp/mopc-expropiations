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
  metadata?: Record<string, any>;
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
                { assignedUserId: session.user.id },
                {
                  assignments: {
                    some: {
                      userId: session.user.id
                    }
                  }
                },
                {
                  department: {
                    OR: [
                      { id: session.user.departmentId },
                      { parentId: session.user.departmentId }
                    ]
                  }
                }
              ]
            },
            {
              OR: [
                { caseNumber: { contains: query, mode: 'insensitive' } },
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { propertyAddress: { contains: query, mode: 'insensitive' } },
                { ownerName: { contains: query, mode: 'insensitive' } },
                { ownerEmail: { contains: query, mode: 'insensitive' } },
              ]
            }
          ]
        },
        include: {
          department: {
            select: { name: true }
          },
          assignedUser: {
            select: { name: true, firstName: true, lastName: true }
          }
        },
        take: params.limit,
      });

      cases.forEach(case_ => {
        const relevance = calculateRelevance(
          params.q,
          case_.title,
          `${case_.description} ${case_.caseNumber} ${case_.propertyAddress} ${case_.ownerName}`
        );

        if (relevance > 0.1) {
          results.push({
            id: case_.id,
            type: 'case',
            title: `${case_.caseNumber} - ${case_.title}`,
            description: case_.description || `${case_.propertyAddress} • ${case_.ownerName}`,
            metadata: {
              status: case_.status,
              priority: case_.priority,
              stage: case_.currentStage,
              department: case_.department?.name,
              assignedTo: case_.assignedUser?.name ||
                `${case_.assignedUser?.firstName} ${case_.assignedUser?.lastName}`.trim(),
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
              case: {
                OR: [
                  { assignedUserId: session.user.id },
                  {
                    assignments: {
                      some: {
                        userId: session.user.id
                      }
                    }
                  },
                  {
                    department: {
                      OR: [
                        { id: session.user.departmentId },
                        { parentId: session.user.departmentId }
                      ]
                    }
                  }
                ]
              }
            },
            {
              OR: [
                { filename: { contains: query, mode: 'insensitive' } },
                { originalName: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { contentType: { contains: query, mode: 'insensitive' } },
              ]
            }
          ]
        },
        include: {
          case: {
            select: {
              caseNumber: true,
              title: true,
              department: { select: { name: true } }
            }
          },
          uploadedBy: {
            select: { name: true, firstName: true, lastName: true }
          }
        },
        take: params.limit,
      });

      documents.forEach(doc => {
        const relevance = calculateRelevance(
          params.q,
          doc.originalName,
          doc.description
        );

        if (relevance > 0.1) {
          results.push({
            id: doc.id,
            type: 'document',
            title: doc.originalName,
            description: doc.description || `Documento del caso ${doc.case?.caseNumber}`,
            metadata: {
              caseNumber: doc.case?.caseNumber,
              caseTitle: doc.case?.title,
              department: doc.case?.department?.name,
              fileType: doc.contentType,
              fileSize: doc.fileSize,
              uploadedBy: doc.uploadedBy?.name ||
                `${doc.uploadedBy?.firstName} ${doc.uploadedBy?.lastName}`.trim(),
              uploadedAt: doc.createdAt.toISOString(),
            },
            url: `/cases/${doc.caseId}?tab=documentos&document=${doc.id}`,
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
                OR: [
                  { departmentId: session.user.departmentId },
                  { department: { parentId: session.user.departmentId } }
                ]
              },
              {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { position: { contains: query, mode: 'insensitive' } },
                ]
              }
            ]
          },
          include: {
            department: {
              select: { name: true }
            }
          },
          take: params.limit,
        });

        users.forEach(user => {
          const relevance = calculateRelevance(
            params.q,
            user.name || `${user.firstName} ${user.lastName}`,
            `${user.email} ${user.position || ''}`
          );

          if (relevance > 0.1) {
            results.push({
              id: user.id,
              type: 'user',
              title: user.name || `${user.firstName} ${user.lastName}`.trim(),
              description: `${user.email} • ${user.position || 'Sin posición'} • ${user.department?.name || 'Sin departamento'}`,
              metadata: {
                role: user.role,
                department: user.department?.name,
                position: user.position,
                email: user.email,
                isActive: user.isActive,
                lastLogin: user.lastLogin?.toISOString(),
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
                  { parentId: session.user.departmentId },
                  {
                    parent: {
                      parentId: session.user.departmentId
                    }
                  }
                ]
              },
              {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { description: { contains: query, mode: 'insensitive' } },
                  { code: { contains: query, mode: 'insensitive' } },
                ]
              }
            ]
          },
          include: {
            parent: {
              select: { name: true }
            },
            _count: {
              select: {
                users: true,
                cases: true,
                children: true
              }
            }
          },
          take: params.limit,
        });

        departments.forEach(dept => {
          const relevance = calculateRelevance(
            params.q,
            dept.name,
            dept.description
          );

          if (relevance > 0.1) {
            results.push({
              id: dept.id,
              type: 'department',
              title: dept.name,
              description: dept.description || `Departamento ${dept.code} • ${dept.parent?.name || 'Sin padre'}`,
              metadata: {
                code: dept.code,
                parent: dept.parent?.name,
                userCount: dept._count.users,
                caseCount: dept._count.cases,
                childCount: dept._count.children,
                isActive: dept.isActive,
                createdAt: dept.createdAt.toISOString(),
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
        { error: 'Invalid search parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}