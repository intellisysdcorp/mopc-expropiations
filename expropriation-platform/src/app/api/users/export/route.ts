import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/users/export - Export users data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const userPermissions = currentUser?.role?.permissions as any;
    if (!userPermissions?.EXPORT && !userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
      return NextResponse.json(
        { error: 'No tienes permisos para exportar usuarios' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const departmentId = searchParams.get('departmentId');
    const roleId = searchParams.get('roleId');
    const isActive = searchParams.get('isActive');
    const isSuspended = searchParams.get('isSuspended');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const fields = searchParams.get('fields')?.split(',') || [
      'id', 'email', 'username', 'firstName', 'lastName', 'phone', 'department', 'role',
      'isActive', 'isSuspended', 'lastLoginAt', 'createdAt'
    ];

    // Build where clause
    const where: any = {};

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
      orderBy: { createdAt: 'desc' },
    });

    // Prepare data for export
    const exportData = users.map((user) => {
      const row: any = {};

      fields.forEach((field) => {
        switch (field) {
          case 'id':
            row['ID'] = user.id;
            break;
          case 'email':
            row['Correo Electrónico'] = user.email;
            break;
          case 'username':
            row['Nombre de Usuario'] = user.username;
            break;
          case 'firstName':
            row['Nombre'] = user.firstName;
            break;
          case 'lastName':
            row['Apellido'] = user.lastName;
            break;
          case 'fullName':
            row['Nombre Completo'] = `${user.firstName} ${user.lastName}`;
            break;
          case 'phone':
            row['Teléfono'] = user.phone || '';
            break;
          case 'department':
            row['Departamento'] = user.department?.name || '';
            break;
          case 'departmentCode':
            row['Código Departamento'] = user.department?.code || '';
            break;
          case 'role':
            row['Rol'] = user.role?.name || '';
            break;
          case 'roleDescription':
            row['Descripción Rol'] = user.role?.description || '';
            break;
          case 'jobTitle':
            row['Cargo'] = user.jobTitle || '';
            break;
          case 'officeLocation':
            row['Oficina'] = user.officeLocation || '';
            break;
          case 'isActive':
            row['Activo'] = user.isActive ? 'Sí' : 'No';
            break;
          case 'isSuspended':
            row['Suspendido'] = user.isSuspended ? 'Sí' : 'No';
            break;
          case 'suspensionReason':
            row['Razón Suspensión'] = user.suspensionReason || '';
            break;
          case 'lastLoginAt':
            row['Último Login'] = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-DO') : '';
            break;
          case 'lastLoginIp':
            row['IP Último Login'] = user.lastLoginIp || '';
            break;
          case 'loginCount':
            row['Conteo Logins'] = user.loginCount || 0;
            break;
          case 'createdAt':
            row['Fecha Creación'] = new Date(user.createdAt).toLocaleString('es-DO');
            break;
          case 'updatedAt':
            row['Fecha Actualización'] = new Date(user.updatedAt).toLocaleString('es-DO');
            break;
          case 'createdCases':
            row['Casos Creados'] = user._count.createdCases;
            break;
          case 'assignedCases':
            row['Casos Asignados'] = user._count.assignedCases;
            break;
          case 'supervisedCases':
            row['Casos Supervisados'] = user._count.supervisedCases;
            break;
          case 'activities':
            row['Actividades'] = user._count.activities;
            break;
          case 'documents':
            row['Documentos'] = user._count.documents;
            break;
          case 'preferredLanguage':
            row['Idioma Preferido'] = user.preferredLanguage || 'es';
            break;
          case 'timezone':
            row['Zona Horaria'] = user.timezone || 'America/Santo_Domingo';
            break;
          case 'emailNotifications':
            row['Notificaciones Email'] = user.emailNotifications ? 'Sí' : 'No';
            break;
          case 'theme':
            row['Tema'] = user.theme || 'light';
            break;
          default:
            row[field] = (user as any)[field] || '';
        }
      });

      return row;
    });

    // Log export activity
    await logActivity({
      userId: session.user.id,
      action: 'EXPORTED',
      entityType: 'user',
      entityId: 'bulk',
      description: `Exportación de usuarios en formato ${format.toUpperCase()}`,
      metadata: {
        format,
        recordCount: users.length,
        fields,
        filters: {
          departmentId,
          roleId,
          isActive,
          isSuspended,
          includeDeleted,
        },
      },
    });

    // Generate export based on format
    switch (format.toLowerCase()) {
      case 'csv':
        return generateCSV(exportData);
      case 'json':
        return generateJSON(exportData);
      case 'excel':
        return generateExcel(exportData);
      default:
        return NextResponse.json(
          { error: 'Formato no soportado' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error exporting users:', error);
    return NextResponse.json(
      { error: 'Error al exportar usuarios' },
      { status: 500 }
    );
  }
}

function generateCSV(data: any[]) {
  if (data.length === 0) {
    return new NextResponse('', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="users.csv"',
      },
    });
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="usuarios.csv"',
    },
  });
}

function generateJSON(data: any[]) {
  const jsonContent = JSON.stringify(data, null, 2);

  return new NextResponse(jsonContent, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="usuarios.json"',
    },
  });
}

function generateExcel(data: any[]) {
  // Simple Excel-like format (tab-separated)
  if (data.length === 0) {
    return new NextResponse('', {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': 'attachment; filename="users.xls"',
      },
    });
  }

  const headers = Object.keys(data[0]);
  const excelContent = [
    headers.join('\t'),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape tabs
        if (typeof value === 'string' && value.includes('\t')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join('\t')
    ),
  ].join('\n');

  return new NextResponse(excelContent, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': 'attachment; filename="usuarios.xls"',
    },
  });
}