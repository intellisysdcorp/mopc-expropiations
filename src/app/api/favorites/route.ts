import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const favoriteSchema = z.object({
  type: z.enum(['case', 'document', 'user', 'department']),
  itemId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  url: z.url(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');

    const where: {
      userId: string;
      type?: string;
    } = {
      userId: session.user.id,
    };

    if (type) {
      where.type = type;
    }

    const favorites = await prisma.favorite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return NextResponse.json({
      favorites: favorites.map(fav => ({
        id: fav.id,
        type: fav.type,
        itemId: fav.itemId,
        title: fav.title,
        description: fav.description,
        url: fav.url,
        metadata: fav.metadata,
        addedAt: fav.createdAt.toISOString(),
        addedBy: `${fav.user.firstName} ${fav.user.lastName}`.trim(),
      })),
      total: favorites.length,
    });
  } catch (error) {
    logger.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, itemId, title, description, url, metadata } = favoriteSchema.parse({
      type: body.type,
      itemId: body.itemId,
      title: body.title,
      description: body.description,
      url: body.url,
      metadata: body.metadata,
    });

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_type_itemId: {
          userId: session.user.id,
          type,
          itemId,
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Item already in favorites' },
        { status: 409 }
      );
    }

    // Verify user has access to the item
    let hasAccess = false;
    try {
      switch (type) {
        case 'case':
          const case_ = await prisma.case.findUnique({
            where: { id: itemId },
            select: { id: true }
          });
          hasAccess = !!case_;
          break;
        case 'document':
          const document = await prisma.document.findUnique({
            where: { id: itemId },
            select: { id: true }
          });
          hasAccess = !!document;
          break;
        case 'user':
          const user = await prisma.user.findUnique({
            where: { id: itemId },
            select: { id: true }
          });
          hasAccess = !!user && ['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role);
          break;
        case 'department':
          const department = await prisma.department.findUnique({
            where: { id: itemId },
            select: { id: true }
          });
          hasAccess = !!department && ['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role);
          break;
      }
    } catch {
      hasAccess = false;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this item' },
        { status: 403 }
      );
    }

    const favoriteCreateObject: any = {
      data: {
        userId: session.user.id,
        type,
        itemId,
        title,
        url,
        metadata,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    };

    if (description) favoriteCreateObject.data.description = description;

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: favoriteCreateObject.data,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: session.user.id,
        action: 'CREATED',
        entityType: 'FAVORITE',
        entityId: favorite.id,
        metadata: {
          itemType: type,
          itemTitle: title,
        },
      }
    });

    const favoriteRes: any = {
      id: favorite.id,
      type: favorite.type,
      itemId: favorite.itemId,
      title: favorite.title,
      description: favorite.description,
      url: favorite.url,
      metadata: favorite.metadata,
      addedAt: favorite.createdAt.toISOString(),
    };

    if (favorite.user) favoriteRes.addedBy =  `${favorite.user.firstName} ${favorite.user.lastName}`.trim();

    return NextResponse.json({ response: { favorite: favoriteRes }});
  } catch (error) {
    logger.error('Error creating favorite:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid favorite data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}