import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, SignatureType } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import type {
  DigitalSignatureWithUser,
  DigitalSignatureResponse,
  VerifySignatureRequest,
  SignatureVerificationResult,
  CreateActivityData,
  ActivityMetadata,
  CreateSignatureRequest,
  SignatureCreateResponse,
  SignatureFilters
} from '@/lib/types/signatures';

// Encryption helper functions
const encryptSignatureData = (data: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.SIGNATURE_SECRET || 'default-secret', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

// GET /api/signatures - Get signatures
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const signatureType = searchParams.get('signatureType');
    const userId = searchParams.get('userId') || session.user.id;

    const where: SignatureFilters = {
      isActive: true,
    };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (signatureType) where.signatureType = signatureType as SignatureType;
    if (userId) where.userId = userId;

    const signatures = await prisma.digitalSignature.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            isActive: true,
            isSuspended: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove encrypted signature data from response for security
    const sanitizedSignatures: DigitalSignatureResponse[] = signatures.map(sig => ({
      ...sig,
      signatureData: '***ENCRYPTED***',
    }));

    return NextResponse.json(sanitizedSignatures);
  } catch (error) {
    logger.error('Error fetching signatures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signatures' },
      { status: 500 }
    );
  }
}

// POST /api/signatures - Create digital signature
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSignatureRequest = await request.json();

    // Check if user already signed this entity
    const existingSignature = await prisma.digitalSignature.findFirst({
      where: {
        userId: session.user.id,
        entityType: body.entityType,
        entityId: body.entityId,
        signatureType: body.signatureType,
        isActive: true,
      },
    });

    if (existingSignature) {
      return NextResponse.json(
        { error: 'You have already signed this entity' },
        { status: 400 }
      );
    }

    // Encrypt signature data
    const encryptedSignatureData = encryptSignatureData(body.signatureData);

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || '';

    const signature: DigitalSignatureWithUser = await prisma.digitalSignature.create({
      data: {
        userId: session.user.id,
        signatureType: body.signatureType,
        entityType: body.entityType,
        entityId: body.entityId,
        signatureData: encryptedSignatureData,
        delegatedBy: body.delegatedBy || null,
        delegationReason: body.delegationReason || null,
        ipAddress,
        userAgent,
        deviceInfo: {
          timestamp: new Date().toISOString(),
          sessionId: session.user.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            isActive: true,
            isSuspended: true,
            createdAt: true,
          },
        },
      },
    });

    // Log activity
    const activityData: CreateActivityData = {
      action: ActivityType.APPROVED,
      entityType: body.entityType,
      entityId: body.entityId,
      description: `Digital signature created for ${body.entityType} (${body.signatureType})`,
      userId: session.user.id,
      metadata: {
        signatureId: signature.id,
        signatureType: body.signatureType,
      } as ActivityMetadata,
    };

    await prisma.activity.create({
      data: activityData,
    });

    // Create base response object
    const signatureResponse: SignatureCreateResponse = {
      id: signature.id,
      userId: signature.userId,
      signatureType: signature.signatureType,
      entityType: signature.entityType,
      entityId: signature.entityId,
      deviceInfo: signature.deviceInfo as any,
      isActive: signature.isActive,
      createdAt: signature.createdAt,
      user: signature.user,
    };

    // Add optional fields conditionally
    if (signature.ipAddress) {
      signatureResponse.ipAddress = signature.ipAddress;
    }
    if (signature.userAgent) {
      signatureResponse.userAgent = signature.userAgent;
    }
    if (signature.delegatedBy) {
      signatureResponse.delegatedBy = signature.delegatedBy;
    }
    if (signature.delegationReason) {
      signatureResponse.delegationReason = signature.delegationReason;
    }

    return NextResponse.json(signatureResponse, { status: 201 });
  } catch (error) {
    logger.error('Error creating digital signature:', error);
    return NextResponse.json(
      { error: 'Failed to create digital signature' },
      { status: 500 }
    );
  }
}

// PUT /api/signatures/verify - Verify signature
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VerifySignatureRequest = await request.json();

    const signature: DigitalSignatureWithUser | null = await prisma.digitalSignature.findUnique({
      where: { id: body.signatureId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            isActive: true,
            isSuspended: true,
            createdAt: true,
          },
        },
      },
    });

    if (!signature) {
      return NextResponse.json(
        { error: 'Signature not found' },
        { status: 404 }
      );
    }

    if (!signature.isActive) {
      return NextResponse.json(
        { error: 'Signature has been revoked' },
        { status: 400 }
      );
    }

    // Verify signature logic would go here
    // For now, we'll just return the signature info
    const verificationResult: SignatureVerificationResult = {
      isValid: true,
      verifiedAt: new Date(),
      verifiedBy: session.user.id,
      signatureInfo: {
        id: signature.id,
        signatureType: signature.signatureType,
        entityType: signature.entityType,
        entityId: signature.entityId,
        createdAt: signature.createdAt,
        user: signature.user,
      },
    };

    // Log verification activity
    const verificationActivityData: CreateActivityData = {
      action: ActivityType.VIEWED,
      entityType: 'digital_signature',
      entityId: signature.id,
      description: `Digital signature verified`,
      userId: session.user.id,
      metadata: verificationResult as ActivityMetadata,
    };

    await prisma.activity.create({
      data: verificationActivityData,
    });

    return NextResponse.json(verificationResult);
  } catch (error) {
    logger.error('Error verifying digital signature:', error);
    return NextResponse.json(
      { error: 'Failed to verify digital signature' },
      { status: 500 }
    );
  }
}