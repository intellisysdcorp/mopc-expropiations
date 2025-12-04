import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Type definition for user creation request body
interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  jobTitle?: string;
  bio?: string;
  officeLocation?: string;
  workingHours?: string;
  preferredLanguage?: string;
  timezone?: string;
  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
  emailMarketing?: boolean;
  emailDigest?: boolean;
  theme?: string;
  dateRange?: string;
  dashboardConfig?: string;
  departmentId: string;
  roleId: string;
}

// GET /api/users - List users with filtering, sorting, and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const roleId = searchParams.get('roleId');
    const isActive = searchParams.get('isActive');
    const isSuspended = searchParams.get('isSuspended');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (isSuspended !== null) {
      where.isSuspended = isSuspended === 'true';
    }

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users with relations
    const users = await prisma.user.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
        _count: {
          select: {
            createdCases: true,
            assignedCases: true,
            supervisedCases: true,
            activities: true,
            documents: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Remove sensitive data
    const sanitizedUsers = users.map((user) => ({
      ...user,
      passwordHash: undefined,
      twoFactorSecret: undefined,
      backupCodes: undefined,
    }));

    return NextResponse.json({
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: CreateUserRequest = await request.json();

    // Check if email or username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: body.email },
          { username: body.username },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El correo electrónico o nombre de usuario ya existe' },
        { status: 400 }
      );
    }

    // Validate department and role exist
    const [department, role] = await Promise.all([
      prisma.department.findUnique({
        where: { id: body.departmentId },
      }),
      prisma.role.findUnique({
        where: { id: body.roleId },
      }),
    ]);

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 400 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create user
    const { password: _1, ...userData } = body;
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash,
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    // Create primary department assignment
    await prisma.userDepartmentAssignment.create({
      data: {
        userId: user.id,
        departmentId: body.departmentId,
        isPrimary: true,
        assignedBy: session.user.id,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'user',
      entityId: user.id,
      description: `Usuario creado: ${user.firstName} ${user.lastName}`,
      metadata: {
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        department: department.name,
        role: role.name,
      },
    });

    // Remove sensitive data
    const { passwordHash: _, ...sanitizedUser } = user;

    return NextResponse.json(sanitizedUser, { status: 201 });
  } catch (error) {
    logger.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}