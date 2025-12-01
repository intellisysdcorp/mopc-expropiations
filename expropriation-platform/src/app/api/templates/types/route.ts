import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TemplateType } from '@prisma/client';
import { logger } from '@/lib/logger';

// GET /api/templates/types - Get available template types
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateTypes = Object.values(TemplateType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: getTemplateTypeDescription(type),
    }));

    return NextResponse.json({ templateTypes });
  } catch (error) {
    logger.error('Error fetching template types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template types' },
      { status: 500 }
    );
  }
}

function getTemplateTypeDescription(type: TemplateType): string {
  const descriptions: { [key in TemplateType]: string } = {
    LEGAL_TEMPLATE: 'Legal document templates for contracts, agreements, and legal notices',
    FORM_TEMPLATE: 'Form templates for data collection and standardized forms',
    REPORT_TEMPLATE: 'Report templates for analysis, summaries, and presentations',
    LETTER_TEMPLATE: 'Letter templates for correspondence and communication',
    CONTRACT_TEMPLATE: 'Contract templates for agreements and commitments',
    MEMO_TEMPLATE: 'Memo templates for internal communication',
    CERTIFICATE_TEMPLATE: 'Certificate templates for awards and certifications',
    NOTIFICATION_TEMPLATE: 'Notification templates for alerts and announcements',
  };

  return descriptions[type] || 'Template type description';
}