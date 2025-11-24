import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
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

    // Check if user has download permission or is owner/admin
    const hasPermission = document.userId === session.user.id ||
                         session.user.role === 'super_admin' ||
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
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}