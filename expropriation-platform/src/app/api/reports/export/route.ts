import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { logger } from '@/lib/logger';

interface ExportOptions {
  format: 'pdf' | 'excel';
  dateRange: {
    from: Date;
    to: Date;
  };
  includeCharts: boolean;
  includeStatistics: boolean;
  includeCases: boolean;
  includeAlerts: boolean;
  departmentId?: string;
  status?: string[];
  priority?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const options: ExportOptions = await request.json();
    const { format: exportFormat } = options;

    // Fetch data based on options
    const data = await fetchExportData(options);

    if (exportFormat === 'pdf') {
      const pdfBuffer = await generatePDFReport(data, options);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf"`
        }
      });
    } else if (exportFormat === 'excel') {
      const excelBuffer = await generateExcelReport(data, options);
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx"`
        }
      });
    }

    throw new Error('Unsupported export format');
  } catch (error) {
    logger.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

async function fetchExportData(options: ExportOptions) {
  const { dateRange, departmentId, includeCases, includeAlerts } = options;
  const startDate = new Date(dateRange.from);
  const endDate = new Date(dateRange.to);

  const departmentFilter = departmentId ? { departmentId } : {};

  const [statistics, cases, alerts, departments] = await Promise.all([
    // Statistics
    fetchStatistics(departmentFilter, startDate, endDate),

    // Cases (if requested)
    includeCases ? fetchCases(departmentFilter, startDate, endDate) : Promise.resolve([]),

    // Alerts (if requested)
    includeAlerts ? fetchAlerts() : Promise.resolve([]),

    // Departments for reference
    fetchDepartments()
  ]);

  return {
    statistics,
    cases,
    alerts,
    departments,
    dateRange,
    generatedAt: new Date()
  };
}

async function fetchStatistics(departmentFilter: any, startDate: Date, endDate: Date) {
  const [totalCases, activeCases, completedCases, pendingCases, highPriorityCases, overdueCases] = await Promise.all([
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        status: { notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED'] },
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        status: 'COMPLETADO',
        actualEndDate: { gte: startDate, lte: endDate }
      }
    }),
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        status: 'PENDIENTE',
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        priority: { in: ['HIGH', 'URGENT'] },
        createdAt: { gte: startDate, lte: endDate }
      }
    }),
    prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        expectedEndDate: { lt: new Date() },
        status: { notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED'] },
        createdAt: { gte: startDate, lte: endDate }
      }
    })
  ]);

  return {
    totalCases,
    activeCases,
    completedCases,
    pendingCases,
    highPriorityCases,
    overdueCases,
    completionRate: totalCases > 0 ? (completedCases / totalCases) * 100 : 0
  };
}

async function fetchCases(departmentFilter: any, startDate: Date, endDate: Date) {
  return await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: {
      department: {
        select: { name: true, code: true }
      },
      createdBy: {
        select: { firstName: true, lastName: true }
      },
      assignedTo: {
        select: { firstName: true, lastName: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function fetchAlerts() {
  // Mock alerts data - in a real implementation, this would query from the alerts system
  return [
    {
      id: 'alert-1',
      type: 'overdue',
      severity: 'high',
      title: 'Caso Vencido',
      message: 'El caso EXP-001 está 5 días vencido',
      createdAt: new Date()
    }
  ];
}

async function fetchDepartments() {
  return await prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true }
  });
}

async function generatePDFReport(data: any, options: ExportOptions): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPosition = 30;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);

    lines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 30;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5 + 2;
    });

    return yPosition;
  };

  // Header
  doc.setFontSize(20);
  doc.text('Reporte de Casos de Expropiación', margin, yPosition);
  yPosition += 15;

  doc.setFontSize(12);
  doc.text(`Generado: ${format(data.generatedAt, 'dd/MM/yyyy HH:mm', { locale: es })}`, margin, yPosition);
  yPosition += 10;
  doc.text(`Período: ${format(data.dateRange.from, 'dd/MM/yyyy')} - ${format(data.dateRange.to, 'dd/MM/yyyy')}`, margin, yPosition);
  yPosition += 20;

  // Statistics Section
  if (options.includeStatistics) {
    yPosition = addText('Estadísticas Generales', 16);
    yPosition += 10;

    const stats = [
      `Total de Casos: ${data.statistics.totalCases}`,
      `Casos Activos: ${data.statistics.activeCases}`,
      `Casos Completados: ${data.statistics.completedCases}`,
      `Casos Pendientes: ${data.statistics.pendingCases}`,
      `Casos de Alta Prioridad: ${data.statistics.highPriorityCases}`,
      `Casos Vencidos: ${data.statistics.overdueCases}`,
      `Tasa de Completación: ${data.statistics.completionRate.toFixed(1)}%`
    ];

    stats.forEach(stat => {
      yPosition = addText(`• ${stat}`, 10);
    });
    yPosition += 15;
  }

  // Cases Section
  if (options.includeCases && data.cases.length > 0) {
    yPosition = addText('Lista de Casos', 16);
    yPosition += 10;

    data.cases.slice(0, 20).forEach((case_: any, index: number) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 30;
      }

      yPosition = addText(`${index + 1}. ${case_.fileNumber} - ${case_.title}`, 11);
      yPosition = addText(`   Propietario: ${case_.ownerName}`, 10);
      yPosition = addText(`   Estado: ${case_.status} | Prioridad: ${case_.priority}`, 10);
      yPosition = addText(`   Departamento: ${case_.department.name}`, 10);
      yPosition += 8;
    });

    if (data.cases.length > 20) {
      yPosition = addText(`... y ${data.cases.length - 20} casos más`, 10);
    }
  }

  // Alerts Section
  if (options.includeAlerts && data.alerts.length > 0) {
    yPosition = addText('Alertas Críticas', 16);
    yPosition += 10;

    data.alerts.forEach((alert: any, index: number) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 30;
      }

      yPosition = addText(`${index + 1}. ${alert.title}`, 11);
      yPosition = addText(`   ${alert.message}`, 10);
      yPosition += 8;
    });
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function generateExcelReport(data: any, options: ExportOptions): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Statistics Sheet
  if (options.includeStatistics) {
    const statsData = [
      ['Estadísticas Generales'],
      [],
      ['Métrica', 'Valor'],
      ['Total de Casos', data.statistics.totalCases],
      ['Casos Activos', data.statistics.activeCases],
      ['Casos Completados', data.statistics.completedCases],
      ['Casos Pendientes', data.statistics.pendingCases],
      ['Casos de Alta Prioridad', data.statistics.highPriorityCases],
      ['Casos Vencidos', data.statistics.overdueCases],
      ['Tasa de Completación (%)', data.statistics.completionRate.toFixed(1)]
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estadísticas');
  }

  // Cases Sheet
  if (options.includeCases && data.cases.length > 0) {
    const casesData = [
      ['ID', 'Número de Caso', 'Título', 'Propietario', 'Dirección', 'Estado', 'Prioridad', 'Departamento', 'Creado por', 'Asignado a', 'Fecha de Creación', 'Fecha Límite']
    ];

    data.cases.forEach((case_: any) => {
      casesData.push([
        case_.id,
        case_.fileNumber,
        case_.title,
        case_.ownerName,
        case_.propertyAddress,
        case_.status,
        case_.priority,
        case_.department.name,
        `${case_.createdBy?.firstName || ''} ${case_.createdBy?.lastName || ''}`,
        `${case_.assignedTo?.firstName || ''} ${case_.assignedTo?.lastName || ''}`,
        format(new Date(case_.createdAt), 'dd/MM/yyyy'),
        case_.expectedEndDate ? format(new Date(case_.expectedEndDate), 'dd/MM/yyyy') : ''
      ]);
    });

    const casesSheet = XLSX.utils.aoa_to_sheet(casesData);
    XLSX.utils.book_append_sheet(workbook, casesSheet, 'Casos');
  }

  // Alerts Sheet
  if (options.includeAlerts && data.alerts.length > 0) {
    const alertsData = [
      ['ID', 'Tipo', 'Severidad', 'Título', 'Mensaje', 'Fecha de Creación']
    ];

    data.alerts.forEach((alert: any) => {
      alertsData.push([
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm')
      ]);
    });

    const alertsSheet = XLSX.utils.aoa_to_sheet(alertsData);
    XLSX.utils.book_append_sheet(workbook, alertsSheet, 'Alertas');
  }

  // Departments Sheet (reference)
  if (data.departments.length > 0) {
    const deptData = [
      ['ID', 'Nombre', 'Código']
    ];

    data.departments.forEach((dept: any) => {
      deptData.push([dept.id, dept.name, dept.code]);
    });

    const deptSheet = XLSX.utils.aoa_to_sheet(deptData);
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'Departamentos');
  }

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.from(excelBuffer);
}