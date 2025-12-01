import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, documentId } = await params

    // Get document with permissions
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        caseId: id
      },
      include: {
        permissions: {
          where: {
            userId: session.user.id,
            expiresAt: {
              gte: new Date()
            }
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if user has view permission or is owner/admin
    const hasPermission = session.user.role === 'super_admin' ||
                         document.permissions.some(p => p.canView)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // TODO: Implement actual preview functionality
    return NextResponse.json({
      message: 'Preview functionality to be implemented',
      documentId,
      fileName: document.fileName,
      previewUrl: `/api/documents/${documentId}/preview-content`
    })

  } catch (error) {
    logger.error('Preview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}