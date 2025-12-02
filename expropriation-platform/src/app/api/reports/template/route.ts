import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'pdf' | 'excel';

    if (type === 'pdf') {
      const pdfBuffer = await generatePDFTemplate();
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="template-report.pdf"'
        }
      });
    } else if (type === 'excel') {
      const excelBuffer = await generateExcelTemplate();
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="template-report.xlsx"'
        }
      });
    }

    throw new Error('Invalid template type');
  } catch (error) {
    logger.error('Template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}

async function generatePDFTemplate(): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPosition = 30;

  // Helper function to add text
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
  doc.text('Plantilla de Reporte de Casos', margin, yPosition);
  yPosition += 15;

  doc.setFontSize(12);
  doc.text('Esta es una plantilla para el reporte de casos de expropiación.', margin, yPosition);
  yPosition += 10;
  doc.text('Complete los campos necesarios y genere el reporte final.', margin, yPosition);
  yPosition += 20;

  // Template Sections
  yPosition = addText('1. Información General', 16);
  yPosition += 10;

  const generalInfo = [
    '• Nombre del Reporte: _________________',
    '• Período: ___________________________',
    '• Departamento: ______________________',
    '• Generado por: ______________________',
    '• Fecha de Generación: _______________'
  ];

  generalInfo.forEach(info => {
    yPosition = addText(info, 11);
  });
  yPosition += 15;

  // Statistics Template
  yPosition = addText('2. Estadísticas', 16);
  yPosition += 10;

  const statsTemplate = [
    '• Total de Casos: __________________',
    '• Casos Activos: ___________________',
    '• Casos Completados: ________________',
    '• Casos Pendientes: _________________',
    '• Tasa de Completación: _____________',
    '• Tiempo Promedio: _________________'
  ];

  statsTemplate.forEach(stat => {
    yPosition = addText(stat, 11);
  });
  yPosition += 15;

  // Cases Template
  yPosition = addText('3. Lista de Casos', 16);
  yPosition += 10;
  yPosition = addText('Tabla de casos con la siguiente información:', 11);
  yPosition += 8;

  const casesHeaders = [
    'ID | Número de Caso | Título | Propietario | Estado | Prioridad | Departamento | Fecha'
  ];

  casesHeaders.forEach(header => {
    yPosition = addText(header, 10);
  });

  yPosition += 10;
  yPosition = addText('1. | __________ | ________ | __________ | ______ | ________ | __________ | ________', 10);
  yPosition = addText('2. | __________ | ________ | __________ | ______ | ________ | __________ | ________', 10);
  yPosition = addText('3. | __________ | ________ | __________ | ______ | ________ | __________ | ________', 10);
  yPosition += 8;

  yPosition = addText('... (continuar con el resto de casos)', 10);
  yPosition += 15;

  // Alerts Template
  yPosition = addText('4. Alertas Críticas', 16);
  yPosition += 10;
  yPosition = addText('1. ________________________________', 11);
  yPosition = addText('   Detalles: _________________________', 10);
  yPosition += 8;
  yPosition = addText('2. ________________________________', 11);
  yPosition = addText('   Detalles: _________________________', 10);
  yPosition += 15;

  // Observations
  yPosition = addText('5. Observaciones y Recomendaciones', 16);
  yPosition += 10;
  yPosition = addText('______________________________________________', 11);
  yPosition += 8;
  yPosition = addText('______________________________________________', 11);
  yPosition += 8;
  yPosition = addText('______________________________________________', 11);
  yPosition += 15;

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalPages} - Plantilla de Reporte`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function generateExcelTemplate(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Instructions Sheet
  const instructionsSheet = workbook.addWorksheet('Instrucciones');
  const instructionsData = [
    ['Instrucciones de Uso'],
    [],
    ['Esta plantilla contiene las siguientes hojas:'],
    ['1. Estadísticas - Para ingresar métricas generales'],
    ['2. Casos - Para listar los casos individuales'],
    ['3. Alertas - Para registrar alertas críticas'],
    ['4. Departamentos - Lista de departamentos de referencia'],
    [],
    ['Instrucciones:'],
    ['1. Complete los datos en cada hoja según corresponda'],
    ['2. No modifique los encabezados de las columnas'],
    ['3. Use los formatos de fecha dd/mm/yyyy'],
    ['4. Para estados use: PENDIENTE, EN_PROGRESO, COMPLETADO, etc.'],
    ['5. Para prioridades use: LOW, MEDIUM, HIGH, URGENT'],
    [],
    ['Generado: ' + new Date().toLocaleDateString('es-ES')]
  ];
  instructionsData.forEach(row => instructionsSheet.addRow(row));

  // Statistics Template Sheet
  const statsSheet = workbook.addWorksheet('Estadísticas');
  const statsTemplate = [
    ['Estadísticas Generales'],
    [],
    ['Métrica', 'Valor', 'Unidad', 'Observaciones'],
    ['Total de Casos', '', 'casos', 'Ingresar el número total'],
    ['Casos Activos', '', 'casos', 'Casos actualmente en proceso'],
    ['Casos Completados', '', 'casos', 'Casos finalizados exitosamente'],
    ['Casos Pendientes', '', 'casos', 'Casos esperando acción'],
    ['Casos de Alta Prioridad', '', 'casos', 'Casos HIGH o URGENT'],
    ['Casos Vencidos', '', 'casos', 'Casos pasados de fecha límite'],
    ['Tasa de Completación', '', '%', 'Porcentaje de casos completados'],
    ['Tiempo Promedio', '', 'días', 'Tiempo promedio de resolución'],
    ['Usuarios Activos', '', 'usuarios', 'Usuarios activos en el período'],
    ['Departamentos', '', 'departamentos', 'Departamentos involucrados']
  ];
  statsTemplate.forEach(row => statsSheet.addRow(row));

  // Cases Template Sheet
  const casesSheet = workbook.addWorksheet('Casos');
  const casesTemplate = [
    ['Lista de Casos'],
    [],
    ['ID', 'Número de Caso', 'Título', 'Propietario', 'Dirección', 'Ciudad', 'Provincia', 'Estado', 'Prioridad', 'Departamento', 'Creado por', 'Asignado a', 'Fecha de Creación', 'Fecha Límite', 'Fecha de Cierre', 'Progreso (%)', 'Observaciones'],
    ['(Ej: caso-001)', '(Ej: EXP-2024-001)', '(Ej: Expropiación Urbana)', '(Ej: Juan Pérez)', '(Ej: Calle Principal #123)', '(Ej: Santo Domingo)', '(Ej: Santo Domingo)', '(Ej: EN_PROGRESO)', '(Ej: HIGH)', '(Ej: Legal)', '(Ej: Admin User)', '(Ej: Analyst User)', '(Ej: 01/01/2024)', '(Ej: 31/12/2024)', '(Ej: 15/06/2024)', '(Ej: 75)', '(Ej: En revisión legal)']
  ];
  casesTemplate.forEach(row => casesSheet.addRow(row));

  // Alerts Template Sheet
  const alertsSheet = workbook.addWorksheet('Alertas');
  const alertsTemplate = [
    ['Alertas Críticas'],
    [],
    ['ID', 'Tipo', 'Severidad', 'Título', 'Mensaje', 'Caso ID', 'Departamento', 'Asignado a', 'Fecha de Creación', 'Estado', 'Acción Tomada', 'Fecha de Resolución'],
    ['(Ej: alert-001)', '(Ej: overdue)', '(Ej: high)', '(Ej: Caso Vencido)', '(Ej: El caso EXP-001 está vencido)', '(Ej: caso-001)', '(Ej: Legal)', '(Ej: John Doe)', '(Ej: 01/01/2024)', '(Ej: active)', '(Ej: Contactar propietario)', '(Ej: 02/01/2024)']
  ];
  alertsTemplate.forEach(row => alertsSheet.addRow(row));

  // Departments Reference Sheet
  const deptSheet = workbook.addWorksheet('Departamentos');
  const deptTemplate = [
    ['Departamentos de Referencia'],
    [],
    ['ID', 'Nombre', 'Código', 'Descripción'],
    ['dept-001', 'Legal', 'LEGAL', 'Departamento de Asuntos Legales'],
    ['dept-002', 'Técnico', 'TECH', 'Departamento Técnico'],
    ['dept-003', 'Financiero', 'FIN', 'Departamento Financiero'],
    ['dept-004', 'Administración', 'ADMIN', 'Departamento Administrativo']
  ];
  deptTemplate.forEach(row => deptSheet.addRow(row));

  // Chart Data Template Sheet
  const chartSheet = workbook.addWorksheet('Datos Gráficos');
  const chartTemplate = [
    ['Datos para Gráficos'],
    [],
    ['Métrica', 'Período 1', 'Período 2', 'Período 3', 'Período 4'],
    ['Casos Creados', '', '', '', ''],
    ['Casos Completados', '', '', '', ''],
    ['Tiempo Promedio (días)', '', '', '', ''],
    ['Tasa de Completación (%)', '', '', '', ''],
    [],
    ['Categoría', 'Valor', 'Descripción'],
    ['Por Prioridad - Baja', '', 'Casos de prioridad baja'],
    ['Por Prioridad - Media', '', 'Casos de prioridad media'],
    ['Por Prioridad - Alta', '', 'Casos de prioridad alta'],
    ['Por Prioridad - Urgente', '', 'Casos de prioridad urgente'],
    ['Por Estado - Pendiente', '', 'Casos en estado pendiente'],
    ['Por Estado - En Progreso', '', 'Casos en progreso'],
    ['Por Estado - Completado', '', 'Casos completados']
  ];
  chartTemplate.forEach(row => chartSheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}