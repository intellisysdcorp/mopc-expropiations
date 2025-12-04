import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Helper function to add fullName to objects with firstName and lastName
function withFullName<T extends { firstName: string; lastName: string }>(obj: T): T & { fullName: string } {
  return {
    ...obj,
    fullName: `${obj.firstName} ${obj.lastName}`,
  };
}

// POST /api/templates/[id]/versions - Create new template version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if template exists and user has permission
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existingTemplate.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get last version number
    const lastVersion = await prisma.documentTemplateVersion.findFirst({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = body.isMajorVersion
      ? Math.floor((lastVersion?.version || 0) / 10) * 10 + 10
      : (lastVersion?.version || 0) + 1;

    // Create new version
    const newVersion = await prisma.documentTemplateVersion.create({
      data: {
        templateId: id,
        version: newVersionNumber,
        content: body.content,
        changeLog: body.changeLog || 'New version created',
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update template
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        version: newVersionNumber,
        content: body.content,
        updatedAt: new Date(),
      },
    });

    // Format response
    const response: any = {
      ...newVersion,
      creator: withFullName(newVersion.creator),
      createdAt: newVersion.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating template version:', error);
    return NextResponse.json(
      { error: 'Failed to create template version' },
      { status: 500 }
    );
  }
}

// GET /api/templates/[id]/versions - Get all versions of a template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if template exists and user has permission
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const hasAccess =
      existingTemplate.createdBy === session.user.id ||
      existingTemplate.isDefault ||
      (existingTemplate.allowedRoles && Array.isArray(existingTemplate.allowedRoles) && existingTemplate.allowedRoles.length > 0) === false;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all versions
    const versions = await prisma.documentTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Format response
    const response = versions.map((version) => ({
      ...version,
      creator: withFullName(version.creator),
      createdAt: version.createdAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching template versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template versions' },
      { status: 500 }
    );
  }
}