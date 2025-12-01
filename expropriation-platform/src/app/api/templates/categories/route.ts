import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DocumentCategory } from '@prisma/client';
import { logger } from '@/lib/logger';

// GET /api/templates/categories - Get template categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = Object.values(DocumentCategory).map(category => ({
      value: category,
      label: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: getCategoryDescription(category),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

function getCategoryDescription(category: DocumentCategory): string {
  const descriptions: { [key in DocumentCategory]: string } = {
    LEGAL: 'Legal documents and legal correspondence',
    TECHNICAL: 'Technical reports, specifications, and documentation',
    FINANCIAL: 'Financial reports, statements, and records',
    ADMINISTRATIVE: 'Administrative documents and procedures',
    COMMUNICATION: 'Communication documents and correspondence',
    PHOTOGRAPHIC: 'Photographs and visual documentation',
    MULTIMEDIA: 'Audio, video, and multimedia content',
    TEMPLATE: 'Document templates and forms',
    REFERENCE: 'Reference materials and documentation',
    CORRESPONDENCE: 'Letters, emails, and correspondence',
  };

  return descriptions[category] || 'Document category description';
}