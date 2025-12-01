import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const itemId = searchParams.get('itemId');

    if (!type || !itemId) {
      return NextResponse.json(
        { error: 'Missing type or itemId parameter' },
        { status: 400 }
      );
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_type_itemId: {
          userId: session.user.id,
          type: type as any,
          itemId,
        }
      }
    });

    return NextResponse.json({
      isFavorite: !!favorite,
      favoriteId: favorite?.id,
    });
  } catch (error) {
    logger.error('Error checking favorite status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}