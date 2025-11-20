import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { logger } from '@/lib/logger';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const exportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv', 'json']),
  dataType: z.enum(['cases', 'users', 'departments', 'reports']),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  filters: z.object({
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    department: z.array(z.string()).optional(),
    includeArchived: z.boolean().default(false),
  }),
  fields: z.array(z.string()),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Helper function to generate Excel file
async function generateExcel(data: any[], dataType: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, dataType);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Helper function to generate CSV file
async function generateCSV(data: any[], fields: string[]) {
  const headers = fields;
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(',')
    )
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

// Helper function to generate PDF file
async function generatePDF(data: any[], dataType: string, fields: string[]) {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(`Exportación de ${dataType}`, 14, 15);

  // Add date
  doc.setFontSize(10);
  doc.text(`Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 25);

  // Add table
  const headers = fields.map(field => {
    // Map field names to human-readable labels
    const fieldLabels: Record<string, string> = {
      caseNumber: 'Número de Caso',
      title: 'Título',
      status: 'Estado',
      priority: 'Prioridad',
      currentStage: 'Etapa Actual',
      propertyAddress: 'Dirección',
      ownerName: 'Propietario',
      estimatedValue: 'Valor Estimado',
      assignedTo: 'Asignado a',
      createdAt: 'Fecha de Creación',
      updatedAt: 'Última Actualización',
      department: 'Departamento',
      name: 'Nombre',
      email: 'Email',
      role: 'Rol',
      position: 'Posición',
      isActive: 'Activo',
      lastLogin: 'Último Login',
      code: 'Código',
      description: 'Descripción',
      parent: 'Departamento Padre',
      userCount: 'Usuarios',
      caseCount: 'Casos',
    };
    return fieldLabels[field] || field;
  });

  const tableData = data.map(row =>
    fields.map(field => {
      let value = row[field];
      if (value instanceof Date) {
        value = format(value, 'dd/MM/yyyy', { locale: es });
      } else if (typeof value === 'boolean') {
        value = value ? 'Sí' : 'No';
      } else if (value === null || value === undefined) {
        value = '';
      }
      return String(value);
    })
  );

  (doc as any).autoTable({
    head: [headers],
    body: tableData,
    startY: 35,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 66, 66],
    },
  });

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
}

// Helper function to fetch and format cases data
async function fetchCasesData(options: any, session: any) {
  const where: any = {
    createdAt: {
      gte: new Date(options.dateRange.start),
      lte: new Date(options.dateRange.end),
    },
  };

  // Apply filters
  if (options.filters.status && options.filters.status.length > 0) {
    where.status = { in: options.filters.status };
  }

  if (options.filters.priority && options.filters.priority.length > 0) {
    where.priority = { in: options.filters.priority };
  }

  if (options.filters.department && options.filters.department.length > 0) {
    where.departmentId = { in: options.filters.department };
  }

  if (!options.filters.includeArchived) {
    where.status = { not: 'ARCHIVED' };
  }

  // Department-based access control
  if (session.user.role !== 'SUPER_ADMIN') {
    where.OR = [
      { assignedUserId: session.user.id },
      {
        assignments: {
          some: { userId: session.user.id }
        }
      },
      {
        department: {
          OR: [
            { id: session.user.departmentId },
            { parentId: session.user.departmentId }
          ]
        }
      }
    ];
  }

  const cases = await prisma.case.findMany({
    where,
    include: {
      department: { select: { name: true } },
      assignedUser: {
        select: {
          name: true,
          firstName: true,
          lastName: true
        }
      },
    },
    orderBy: { [options.sortBy]: options.sortOrder },
  });

  return cases.map(case_ => ({
    caseNumber: case_.fileNumber,
    title: case_.title,
    status: case_.status,
    priority: case_.priority,
    currentStage: case_.currentStage,
    propertyAddress: case_.propertyAddress,
    ownerName: case_.ownerName,
    estimatedValue: case_.estimatedValue,
    assignedTo: case_.assignedUser?.name ||
               `${case_.assignedUser?.firstName} ${case_.assignedUser?.lastName}`.trim() || '',
    createdAt: case_.createdAt,
    updatedAt: case_.updatedAt,
    department: case_.department?.name || '',
  }));
}

// Helper function to fetch and format users data
async function fetchUsersData(options: any, session: any) {
  const where: any = {
    createdAt: {
      gte: new Date(options.dateRange.start),
      lte: new Date(options.dateRange.end),
    },
  };

  // Department-based access control for department admins
  if (session.user.role === 'DEPARTMENT_ADMIN') {
    where.OR = [
      { departmentId: session.user.departmentId },
      { department: { parentId: session.user.departmentId } }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      department: { select: { name: true } },
      _count: {
        select: { cases: true }
      }
    },
    orderBy: { [options.sortBy]: options.sortOrder },
  });

  return users.map(user => ({
    name: user.name || `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    department: user.department?.name || '',
    position: user.position || '',
    isActive: user.isActive,
    lastLogin: user.lastLoginAt,
    createdAt: user.createdAt,
  }));
}

// Helper function to fetch and format departments data
async function fetchDepartmentsData(options: any, session: any) {
  const where: any = {
    createdAt: {
      gte: new Date(options.dateRange.start),
      lte: new Date(options.dateRange.end),
    },
  };

  // Department-based access control
  if (session.user.role === 'DEPARTMENT_ADMIN') {
    where.OR = [
      { id: session.user.departmentId },
      { parentId: session.user.departmentId },
      { parent: { parentId: session.user.departmentId } }
    ];
  }

  const departments = await prisma.department.findMany({
    where,
    include: {
      parent: { select: { name: true } },
      _count: {
        select: {
          users: true,
          cases: true,
          children: true
        }
      }
    },
    orderBy: { [options.sortBy]: options.sortOrder },
  });

  return departments.map(dept => ({
    name: dept.name,
    code: dept.code,
    description: dept.description || '',
    parent: dept.parent?.name || '',
    isActive: dept.isActive,
    userCount: dept._count.users,
    caseCount: dept._count.cases,
    childCount: dept._count.children,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const options = exportSchema.parse(body);

    // Fetch data based on type
    let data: any[] = [];
    switch (options.dataType) {
      case 'cases':
        data = await fetchCasesData(options, session);
        break;
      case 'users':
        // Only allow admins to export users
        if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role)) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        data = await fetchUsersData(options, session);
        break;
      case 'departments':
        // Only allow admins to export departments
        if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(session.user.role)) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        data = await fetchDepartmentsData(options, session);
        break;
      case 'reports':
        // Reports data would be fetched from a reports table
        data = [];
        break;
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'No data found for the specified criteria' }, { status: 404 });
    }

    // Filter data to include only selected fields
    if (options.fields.length > 0) {
      data = data.map(item => {
        const filtered: any = {};
        options.fields.forEach((field: string) => {
          if (field in item) {
            filtered[field] = item[field];
          }
        });
        return filtered;
      });
    }

    // Generate file based on format
    let blob: Blob;
    let fileName: string;
    let mimeType: string;

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss', { locale: es });

    switch (options.format) {
      case 'excel':
        blob = await generateExcel(data, options.dataType);
        fileName = `${options.dataType}_export_${timestamp}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        blob = await generateCSV(data, options.fields);
        fileName = `${options.dataType}_export_${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'pdf':
        blob = await generatePDF(data, options.dataType, options.fields);
        fileName = `${options.dataType}_export_${timestamp}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'json':
        const jsonData = JSON.stringify(data, null, 2);
        blob = new Blob([jsonData], { type: 'application/json' });
        fileName = `${options.dataType}_export_${timestamp}.json`;
        mimeType = 'application/json';
        break;
      default:
        return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    }

    // Convert blob to base64 for response
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Log export activity
    await prisma.activity.create({
      data: {
        userId: session.user.id,
        type: 'EXPORTED',
        entityType: options.dataType.toUpperCase(),
        details: {
          format: options.format,
          recordCount: data.length,
          dateRange: options.dateRange,
          filters: options.filters,
        },
      }
    });

    return NextResponse.json({
      success: true,
      fileName,
      mimeType,
      data: `data:${mimeType};base64,${base64}`,
      recordCount: data.length,
    });
  } catch (error) {
    logger.error('Export error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid export parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}