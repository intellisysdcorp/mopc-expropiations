import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger';
import { URLParams } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, documentId } = await params
    if (!id || !documentId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

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

    // Check if user has download permission or is owner/admin
    const hasPermission = session.user.role === 'super_admin' ||
                         document.permissions.some(p => p.canDownload)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // TODO: Implement actual file download logic
    return NextResponse.json({
      message: 'Download functionality to be implemented',
      documentId,
      fileName: document.fileName
    })

  } catch (error) {
    logger.error('Download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}