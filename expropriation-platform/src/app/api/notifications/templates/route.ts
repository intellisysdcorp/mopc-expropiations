import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  category: z.string().default('GENERAL'),
  type: z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'TASK_ASSIGNED', 'DEADLINE_REMINDER', 'STATUS_UPDATE', 'SYSTEM_ANNOUNCEMENT']),
  subject: z.string().optional(),
  content: z.string().min(1, 'El contenido es requerido'),
  htmlContent: z.string().optional(),
  variables: z.record(z.any()).optional(),
  placeholders: z.record(z.any()).optional(),
  defaultChannels: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  language: z.string().default('es'),
  translations: z.record(z.any()).optional(),
  requiredRole: z.string().optional(),
  departmentId: z.string().optional()
});

const updateTemplateSchema = createTemplateSchema.partial();

// Get notification templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const language = searchParams.get('language');
    const search = searchParams.get('search');

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true, department: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build where clause
    const where: any = {};

    // Apply role-based filtering
    const isAdmin = user.role.name === 'SUPER_ADMIN';
    const isDepartmentAdmin = user.role.name === 'DEPARTMENT_ADMIN';

    if (!isAdmin) {
      where.OR = [
        { requiredRole: null },
        { requiredRole: user.role.name }
      ];

      if (isDepartmentAdmin && user.departmentId) {
        where.OR.push({
          departmentId: user.departmentId
        });
      }
    }

    if (category) {
      where.category = category;
    }

    if (type) {
      where.type = type;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (language) {
      where.language = language;
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get templates with pagination
    const [templates, total] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where,
        include: {
          creator: {
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
              code: true
            }
          },
          _count: {
            select: {
              notifications: true
            }
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.notificationTemplate.count({ where })
    ]);

    // Get statistics
    const statistics = await getTemplateStatistics();

    return NextResponse.json({
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      statistics
    });

  } catch (error) {
    logger.error('Error fetching notification templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new notification template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createTemplateSchema.parse(body);

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true, department: true }
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

    // Check if this is being set as default for its type/category
    if (validatedData.isDefault) {
      await prisma.notificationTemplate.updateMany({
        where: {
          type: validatedData.type,
          category: validatedData.category,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    // Process variables and placeholders from content
    const extractedVariables = extractVariables(validatedData.content);
    const extractedPlaceholders = extractPlaceholders(validatedData.content);

    // Create template
    const template = await prisma.notificationTemplate.create({
      data: {
        ...validatedData,
        createdBy: user.id,
        variables: {
          ...validatedData.variables,
          ...extractedVariables
        },
        placeholders: {
          ...validatedData.placeholders,
          ...extractedPlaceholders
        }
      },
      include: {
        creator: {
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
            code: true
          }
        }
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'CREATED',
        entityType: 'notification_template',
        entityId: template.id,
        description: `Created notification template: ${template.name}`,
        metadata: {
          templateId: template.id,
          name: template.name,
          type: template.type,
          category: template.category
        }
      }
    });

    return NextResponse.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error('Error creating notification template:', error);

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
async function getTemplateStatistics() {
  const [
    total,
    active,
    byCategory,
    byType,
    byLanguage,
    mostUsed
  ] = await Promise.all([
    prisma.notificationTemplate.count(),
    prisma.notificationTemplate.count({ where: { isActive: true } }),
    prisma.notificationTemplate.groupBy({
      by: ['category'],
      _count: { category: true }
    }),
    prisma.notificationTemplate.groupBy({
      by: ['type'],
      _count: { type: true }
    }),
    prisma.notificationTemplate.groupBy({
      by: ['language'],
      _count: { language: true }
    }),
    prisma.notificationTemplate.findMany({
      orderBy: { usageCount: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        usageCount: true,
        lastUsedAt: true
      }
    })
  ]);

  return {
    total,
    active,
    inactive: total - active,
    byCategory: byCategory.reduce((acc, stat) => {
      acc[stat.category] = stat._count.category;
      return acc;
    }, {} as Record<string, number>),
    byType: byType.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {} as Record<string, number>),
    byLanguage: byLanguage.reduce((acc, stat) => {
      acc[stat.language] = stat._count.language;
      return acc;
    }, {} as Record<string, number>),
    mostUsed
  };
}

function extractVariables(content: string): Record<string, any> {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables: Record<string, any> = {};
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    const variableName = match[1];
    variables[variableName] = {
      type: inferVariableType(variableName),
      description: `Variable: ${variableName}`,
      required: true,
      example: getVariableExample(variableName)
    };
  }

  return variables;
}

function extractPlaceholders(content: string): Record<string, any> {
  const placeholderPattern = /\{\{(\w+(?:\.\w+)*)\}\}/g;
  const placeholders: Record<string, any> = {};
  let match;

  while ((match = placeholderPattern.exec(content)) !== null) {
    const placeholder = match[1];
    placeholders[placeholder] = {
      description: `Placeholder: ${placeholder}`,
      example: getPlaceholderExample(placeholder)
    };
  }

  return placeholders;
}

function inferVariableType(variableName: string): string {
  const name = variableName.toLowerCase();

  if (name.includes('date') || name.includes('time')) return 'date';
  if (name.includes('email')) return 'email';
  if (name.includes('phone') || name.includes('telefono')) return 'phone';
  if (name.includes('amount') || name.includes('cantidad') || name.includes('monto')) return 'number';
  if (name.includes('url') || name.includes('link')) return 'url';

  return 'string';
}

function getVariableExample(variableName: string): string {
  const name = variableName.toLowerCase();

  if (name.includes('nombre') || name.includes('name')) return 'Juan Pérez';
  if (name.includes('email')) return 'juan.perez@email.com';
  if (name.includes('telefono') || name.includes('phone')) return '809-123-4567';
  if (name.includes('fecha') || name.includes('date')) return new Date().toLocaleDateString();
  if (name.includes('hora') || name.includes('time')) return new Date().toLocaleTimeString();
  if (name.includes('caso') || name.includes('case')) return 'EXP-2024-001';
  if (name.includes('departamento') || name.includes('department')) return 'Departamento Legal';

  return variableName;
}

function getPlaceholderExample(placeholder: string): string {
  const parts = placeholder.split('.');

  if (parts[0] === 'user') {
    if (parts[1] === 'name') return 'Juan Pérez';
    if (parts[1] === 'email') return 'juan.perez@email.com';
    if (parts[1] === 'phone') return '809-123-4567';
    if (parts[1] === 'department') return 'Departamento Legal';
  }

  if (parts[0] === 'case') {
    if (parts[1] === 'number') return 'EXP-2024-001';
    if (parts[1] === 'title') return 'Expropiación Urbana';
    if (parts[1] === 'status') return 'En Progreso';
  }

  if (parts[0] === 'system') {
    if (parts[1] === 'date') return new Date().toLocaleDateString();
    if (parts[1] === 'time') return new Date().toLocaleTimeString();
  }

  return placeholder;
}