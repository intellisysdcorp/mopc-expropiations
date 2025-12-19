import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@/prisma/client';
import { logger } from '@/lib/logger';
import type {
  DigitalSignature,
  UserWithRole,
  RevokeSignatureData,
  CreateActivityData,
  ActivityMetadata,
  SignatureRevokeResponse
} from '@/lib/types/signatures';
import { URLParams } from '@/types';

const revokeSignatureSchema = z.object({
  reason: z.string().min(1, 'Revocation reason is required'),
});

// POST /api/signatures/[id]/revoke - Revoke a digital signature
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Bad Request: missing key param'},
      { status: 400 }
    )
  }
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = revokeSignatureSchema.parse(body);

    // Check if signature exists and user has permission
    const signature: DigitalSignature | null = await prisma.digitalSignature.findUnique({
      where: { id },
    });

    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 404 }
      );
    }

    // Users can only revoke their own signatures, admins can revoke any
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    }) as UserWithRole | null;

    const canRevoke =
      signature.userId === session.user.id ||
      user?.role.name === 'SUPER_ADMIN' ||
      user?.role.name === 'DEPARTMENT_ADMIN';

    if (!canRevoke) {
      return NextResponse.json(
        { error: 'Insufficient permissions to revoke this signature' },
        { status: 403 }
      );
    }

    if (!signature.isActive) {
      return NextResponse.json(
        { error: 'Signature is already revoked' },
        { status: 400 }
      );
    }

    // Revoke the signature
    const revokeData: RevokeSignatureData = {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: session.user.id,
      revokedReason: validatedData.reason,
    };

    const revokedSignature: DigitalSignature = await prisma.digitalSignature.update({
      where: { id },
      data: revokeData,
    });

    // Log activity
    const activityData: CreateActivityData = {
      action: ActivityType.DELETED,
      entityType: 'digital_signature',
      entityId: signature.id,
      description: `Digital signature revoked: ${validatedData.reason}`,
      userId: session.user.id,
      metadata: {
        signatureId: signature.id,
        signatureType: signature.signatureType,
        entityType: signature.entityType,
        entityId: signature.entityId,
        revocationReason: validatedData.reason,
      } as ActivityMetadata,
    };

    await prisma.activity.create({
      data: activityData,
    });

    const response: SignatureRevokeResponse = {
      message: 'Signature revoked successfully',
      signature: {
        id: revokedSignature.id,
        revokedAt: revokedSignature.revokedAt as Date | null,
        revokedReason: revokedSignature.revokedReason as string | null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error revoking digital signature:', error);
    return NextResponse.json(
      { error: 'Failed to revoke digital signature' },
      { status: 500 }
    );
  }
}