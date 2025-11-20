import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, SignatureType } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Validation schemas
const createSignatureSchema = z.object({
  signatureType: z.nativeEnum(SignatureType),
  entityType: z.string(),
  entityId: z.string(),
  signatureData: z.string(), // Base64 encoded signature data
  delegatedBy: z.string().optional(),
  delegationReason: z.string().optional(),
});

const verifySignatureSchema = z.object({
  signatureId: z.string(),
  verificationData: z.string(), // Additional verification data
});

// Encryption helper functions
const encryptSignatureData = (data: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.SIGNATURE_SECRET || 'default-secret', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key, iv);

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

    const where: any = {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove encrypted signature data from response for security
    const sanitizedSignatures = signatures.map(sig => ({
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

    const body = await request.json();
    const validatedData = createSignatureSchema.parse(body);

    // Check if user already signed this entity
    const existingSignature = await prisma.digitalSignature.findFirst({
      where: {
        userId: session.user.id,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        signatureType: validatedData.signatureType,
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
    const encryptedSignatureData = encryptSignatureData(validatedData.signatureData);

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || '';

    const signature = await prisma.digitalSignature.create({
      data: {
        userId: session.user.id,
        signatureType: validatedData.signatureType,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        signatureData: encryptedSignatureData,
        delegatedBy: validatedData.delegatedBy,
        delegationReason: validatedData.delegationReason,
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
          },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.APPROVED,
        entityType: validatedData.entityType,
        entityId: validatedData.entityId,
        description: `Digital signature created for ${validatedData.entityType} (${validatedData.signatureType})`,
        userId: session.user.id,
        metadata: {
          signatureId: signature.id,
          signatureType: validatedData.signatureType,
        },
      },
    });

    // Return signature without encrypted data
    const { signatureData: _, ...sanitizedSignature } = signature;

    return NextResponse.json(sanitizedSignature, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

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

    const body = await request.json();
    const validatedData = verifySignatureSchema.parse(body);

    const signature = await prisma.digitalSignature.findUnique({
      where: { id: validatedData.signatureId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
    const verificationResult = {
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
    await prisma.activity.create({
      data: {
        action: ActivityType.VIEWED,
        entityType: 'digital_signature',
        entityId: signature.id,
        description: `Digital signature verified`,
        userId: session.user.id,
        metadata: verificationResult,
      },
    });

    return NextResponse.json(verificationResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error verifying digital signature:', error);
    return NextResponse.json(
      { error: 'Failed to verify digital signature' },
      { status: 500 }
    );
  }
}