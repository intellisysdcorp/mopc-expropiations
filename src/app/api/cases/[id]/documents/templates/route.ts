import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs/promises';
import path from 'path';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// Define document templates for different stages and document types
const DOCUMENT_TEMPLATES = {
  // Legal templates
  'LEGAL': {
    'NOTIFICACION_EXPROPIACION': {
      title: 'Notificación de Expropiación',
      description: 'Plantilla oficial para notificar a propietarios sobre el proceso de expropiación',
      category: 'LEGAL',
      securityLevel: 'INTERNAL',
      content: `
[MEMBRETE OFICIAL]

NOTIFICACIÓN DE EXPROPIACIÓN
Expediente No: [NUMERO_EXPEDIENTE]
Fecha: [FECHA]

[PROPIETARIO_NOMBRE]
[PROPIETARIO_DIRECCIÓN]

Asunto: Notificación de Proceso de Expropiación

Por medio de la presente, se le notifica que [INSTITUCIÓN] ha iniciado el proceso de expropiación para el siguiente inmueble:

Dirección: [PROPIEDAD_DIRECCIÓN]
Cédula Catastral: [CATASTRO]
Área: [AREA] m²

Fundamento Legal:
[BASE_LEGAL]

Próximos Pasos:
1. Presentación de documentos
2. Evaluación técnica
3. Tasación
4. Negociación

Para cualquier consulta, contactar:
[CONTACTO_INSTITUCIÓN]

Firma:___________________
Nombre: [NOMBRE_AUTORIZADO]
Cargo: [CARGO_AUTORIZADO]
      `.trim(),
      placeholders: ['NUMERO_EXPEDIENTE', 'FECHA', 'PROPIETARIO_NOMBRE', 'PROPIETARIO_DIRECCION', 'PROPIEDAD_DIRECCION', 'CATASTRO', 'AREA', 'BASE_LEGAL', 'CONTACTO_INSTITUCION', 'NOMBRE_AUTORIZADO', 'CARGO_AUTORIZADO']
    },
    'OFERTA_COMPRA': {
      title: 'Oficial de Compra',
      description: 'Oficial formal de compra por parte de la institución',
      category: 'LEGAL',
      securityLevel: 'CONFIDENTIAL',
      content: `
[MEMBRETE OFICIAL]

OFERTA DE COMPRA
Expediente No: [NUMERO_EXPEDIENTE]
Fecha: [FECHA]

[PROPIETARIO_NOMBRE]
[PROPIETARIO_DIRECCIÓN]

Estimado/a [PROPIETARIO_NOMBRE],

[INSTITUCIÓN] presenta la siguiente oferta de compra por el inmueble ubicado en:

Dirección: [PROPIEDAD_DIRECCIÓN]
Área: [AREA] m²
Valor Ofrecido: [VALOR_OFERTA] DOP

Esta oferta se basa en:
- Tasación profesional: [VALOR_TASACION] DOP
- Análisis de mercado: [VALOR_MERCADO] DOP
- Valor fiscal: [VALOR_FISCAL] DOP

Condiciones:
1. Pago en [FORMA_PAGO]
2. Plazo: [PLAZO] días
3. Incluye: [INCLUSIONES]

La oferta es válida hasta [FECHA_VENCIMIENTO].

Atentamente,

Firma:___________________
      `.trim(),
      placeholders: ['NUMERO_EXPEDIENTE', 'FECHA', 'PROPIETARIO_NOMBRE', 'PROPIETARIO_DIRECCION', 'INSTITUCION', 'PROPIEDAD_DIRECCION', 'AREA', 'VALOR_OFERTA', 'VALOR_TASACION', 'VALOR_MERCADO', 'VALOR_FISCAL', 'FORMA_PAGO', 'PLAZO', 'INCLUSIONES', 'FECHA_VENCIMIENTO']
    }
  },

  // Technical templates
  'TECHNICAL': {
    'INFORME_TECNICO': {
      title: 'Informe Técnico de Propiedad',
      description: 'Evaluación técnica detallada del inmueble',
      category: 'TECHNICAL',
      securityLevel: 'INTERNAL',
      content: `
[MEMBRETE OFICIAL]

INFORME TÉCNICO DE EVALUACIÓN
Expediente No: [NUMERO_EXPEDIENTE]
Fecha de Inspección: [FECHA_INSPECCION]
Técnico Responsable: [TECNICO_NOMBRE]

1. DATOS GENERALES
Dirección: [PROPIEDAD_DIRECCIÓN]
Propietario: [PROPIETARIO_NOMBRE]
Área del Terreno: [AREA_TERRENO] m²
Área Construida: [AREA_CONSTRUIDA] m²

2. CARACTERÍSTICAS FÍSICAS
- Topografía: [TOPOGRAFIA]
- Acceso: [ACCESO]
- Servicios: [SERVICIOS]
- Construcciones: [CONSTRUCCIONES]
- Estado de Conservación: [ESTADO_CONSERVACION]

3. UBICACIÓN Y ENTORNO
- Sector: [SECTOR]
- Uso de Suelo: [USO_SUELO]
- Infraestructura cercana: [INFRAESTRUCTURA]
- Valoración del entorno: [VALORACION_ENTORNO]

4. OBSERVACIONES Y RECOMENDACIONES
[OBSERVACIONES]

5. CONCLUSIONES
[CONCLUSIONES]

Firma:___________________
[TECNICO_NOMBRE]
[CARGO_TECNICO]
      `.trim(),
      placeholders: ['NUMERO_EXPEDIENTE', 'FECHA_INSPECCION', 'TECNICO_NOMBRE', 'PROPIEDAD_DIRECCION', 'PROPIETARIO_NOMBRE', 'AREA_TERRENO', 'AREA_CONSTRUIDA', 'TOPOGRAFIA', 'ACCESO', 'SERVICIOS', 'CONSTRUCCIONES', 'ESTADO_CONSERVACION', 'SECTOR', 'USO_SUELO', 'INFRAESTRUCTURA', 'VALORACION_ENTORNO', 'OBSERVACIONES', 'CONCLUSIONES', 'CARGO_TECNICO']
    }
  },

  // Financial templates
  'FINANCIAL': {
    'VALUATION_REPORT': {
      title: 'Informe de Tasación',
      description: 'Informe profesional de valoración del inmueble',
      category: 'FINANCIAL',
      securityLevel: 'CONFIDENTIAL',
      content: `
[MEMBRETE OFICIAL]

INFORME DE TASACIÓN
Expediente No: [NUMERO_EXPEDIENTE]
Fecha de Tasación: [FECHA_TASACION]
Tasador: [TASADOR_NOMBRE]
Matrícula Profesional: [MATRICULA_TASADOR]

1. IDENTIFICACIÓN DEL INMUEBLE
Dirección: [PROPIEDAD_DIRECCIÓN]
Cédula Catastral: [CATASTRO]
Propietario: [PROPIETARIO_NOMBRE]

2. VALORACIONES
- Valor Terreno: [VALOR_TERRENO] DOP
- Valor Construcciones: [VALOR_CONSTRUCCIONES] DOP
- Valor Total: [VALOR_TOTAL] DOP
- Valor por m²: [VALOR_M2] DOP

3. MÉTODO DE VALORACIÓN
[METODO_VALORACION]

4. ANÁLISIS DE MERCADO
[ANALISIS_MERCADO]

5. FACTORES DE AJUSTE
[FACTORES_AJUSTE]

6. CONCLUSIÓN FINAL
Valor de mercado estimado: [VALOR_FINAL] DOP

Firma:___________________
[TASADOR_NOMBRE]
Tasador Profesional Mat. [MATRICULA_TASADOR]
      `.trim(),
      placeholders: ['NUMERO_EXPEDIENTE', 'FECHA_TASACION', 'TASADOR_NOMBRE', 'MATRICULA_TASADOR', 'PROPIEDAD_DIRECCION', 'CATASTRO', 'PROPIETARIO_NOMBRE', 'VALOR_TERRENO', 'VALOR_CONSTRUCCIONES', 'VALOR_TOTAL', 'VALOR_M2', 'METODO_VALORACION', 'ANALISIS_MERCADO', 'FACTORES_AJUSTE', 'VALOR_FINAL']
    }
  }
};

// GET /api/cases/[id]/documents/templates - Get available templates for case stage
export async function GET(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    if (!caseId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');

    // Verify case exists and user has access
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        fileNumber: true,
        currentStage: true,
        departmentId: true,
        createdById: true,
        assignedToId: true,
        supervisedById: true,
      },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get templates for the specified document type or all available templates
    let templates = [];

    if (documentType && DOCUMENT_TEMPLATES[documentType as keyof typeof DOCUMENT_TEMPLATES]) {
      templates = Object.entries(DOCUMENT_TEMPLATES[documentType as keyof typeof DOCUMENT_TEMPLATES]).map(
        ([key, template]) => ({
          id: `${documentType}_${key}`,
          type: documentType,
          ...template,
        })
      );
    } else {
      // Get all templates
      templates = Object.entries(DOCUMENT_TEMPLATES).flatMap(([type, typeTemplates]) =>
        Object.entries(typeTemplates).map(([key, template]) => ({
          id: `${type}_${key}`,
          type,
          ...template,
        }))
      );
    }

    // Get case-specific data for placeholder filling
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        department: true,
        createdBy: true,
        assignedTo: true,
      },
    });

    // Prepare case data for template placeholders
    const caseContext = {
      NUMERO_EXPEDIENTE: case_?.fileNumber || '',
      PROPIETARIO_NOMBRE: caseData?.ownerName || '',
      PROPIETARIO_DIRECCION: caseData?.ownerAddress || '',
      PROPIEDAD_DIRECCION: caseData?.propertyAddress || '',
      PROPIEDAD_CIUDAD: caseData?.propertyCity || '',
      PROPIEDAD_PROVINCIA: caseData?.propertyProvince || '',
      AREA: caseData?.propertyArea?.toString() || '',
      INSTITUCION: caseData?.department?.name || '',
    };

    return NextResponse.json({
      templates,
      caseContext,
      currentStage: case_.currentStage,
    });
  } catch (error) {
    logger.error('Error fetching document templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/documents/templates - Create document from template
export async function POST(
  request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    if (!caseId) {
      return NextResponse.json(
        { error: 'Bad Request: missing key param'},
        { status: 400 }
      )
    }

    const { templateId, templateData, customizations } = await request.json();

    if (!templateId || !templateData) {
      return NextResponse.json(
        { error: 'Template ID and data are required' },
        { status: 400 }
      );
    }

    // Verify case exists and user has access
    const case_ = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        departmentId: true,
        createdById: true,
        assignedToId: true,
        supervisedById: true,
      },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check access permissions
    const hasAccess =
      case_.createdById === session.user.id ||
      case_.assignedToId === session.user.id ||
      case_.supervisedById === session.user.id ||
      await hasDepartmentAccess(session.user.id, case_.departmentId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse template ID to get type and key
    const [type, key] = templateId.split('_', 2);

    const templateCategory = DOCUMENT_TEMPLATES[type as keyof typeof DOCUMENT_TEMPLATES];

    if (!templateCategory) {
      return NextResponse.json(
        { error: 'Template category not found' },
        { status: 404 }
      );
    }

    const template = (templateCategory as any)[key];

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Fill placeholders with template data
    let content = template.content;
    template.placeholders.forEach((placeholder: string) => {
      const value = templateData[placeholder] || `[${placeholder}]`;
      content = content.replace(new RegExp(`\\[${placeholder}\\]`, 'g'), value);
    });

    // Apply customizations if provided
    if (customizations) {
      content = customizations.content || content;
    }

    // Create a temporary document file
    const fileName = `${template.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const tempDir = path.join(process.cwd(), 'temp');

    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);

    // For now, create a simple text file
    // TODO: Implement proper document generation (DOCX, PDF)
    await fs.writeFile(filePath, content, 'utf-8');

    // Create document record
    const document = await prisma.document.create({
      data: {
        title: customizations?.title || template.title,
        description: customizations?.description || template.description,
        fileName: fileName,
        originalFileName: `${template.title}.docx`,
        filePath: path.relative(process.cwd(), filePath),
        fileSize: (await fs.stat(filePath)).size,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        documentType: template.type as any,
        category: template.category as any,
        status: 'DRAFT',
        securityLevel: template.securityLevel as any,
        version: 1,
        isLatest: true,
        isDraft: true,
        caseId,
        uploadedById: session.user.id,
        metadata: {
          templateId,
          generatedFrom: 'template',
          placeholders: template.placeholders,
          customizations,
        },
        contentText: content,
        isIndexed: true,
        indexedAt: new Date(),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'CREATED',
        entityType: 'document',
        entityId: document.id,
        description: `Document created from template: ${template.title}`,
        userId: session.user.id,
        caseId,
        metadata: {
          templateId,
          documentId: document.id,
          documentTitle: document.title,
          createdBy: 'template',
        },
      },
    });

    return NextResponse.json({
      ...document,
      uploadedBy: {
        ...document.uploadedBy,
        fullName: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
      },
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Error creating document from template:', error);
    return NextResponse.json(
      { error: 'Failed to create document from template' },
      { status: 500 }
    );
  }
}

async function hasDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      role: {
        select: { permissions: true }
      }
    },
  });

  if (!user) return false;

  const sameDepartment = user.departmentId === departmentId;
  const permissions = user.role?.permissions as any;
  const hasAdminAccess = permissions?.admin ||
                        permissions?.allDepartments ||
                        permissions?.viewAllCases;

  return sameDepartment || hasAdminAccess;
}