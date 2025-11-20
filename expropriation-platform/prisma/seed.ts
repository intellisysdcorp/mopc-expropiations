import { PrismaClient, CaseStage } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');

  // Create roles
await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'Administrador con acceso completo al sistema',
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canAssign: true,
        canSupervise: true,
        canExport: true,
        canManageUsers: true,
      },
    },
  });

await prisma.role.upsert({
    where: { name: 'department_admin' },
    update: {},
    create: {
      name: 'department_admin',
      description: 'Administrador de departamento',
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: false,
        canAssign: true,
        canSupervise: true,
        canExport: true,
        canManageUsers: false,
      },
    },
  });

await prisma.role.upsert({
    where: { name: 'analyst' },
    update: {},
    create: {
      name: 'analyst',
      description: 'Analista de casos',
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: false,
        canAssign: false,
        canSupervise: false,
        canExport: true,
        canManageUsers: false,
      },
    },
  });

await prisma.role.upsert({
    where: { name: 'supervisor' },
    update: {},
    create: {
      name: 'supervisor',
      description: 'Supervisor de casos',
      permissions: {
        canCreate: false,
        canRead: true,
        canUpdate: true,
        canDelete: false,
        canAssign: true,
        canSupervise: true,
        canExport: true,
        canManageUsers: false,
      },
    },
  });

await prisma.role.upsert({
    where: { name: 'observer' },
    update: {},
    create: {
      name: 'observer',
      description: 'Observador con solo lectura',
      permissions: {
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
        canAssign: false,
        canSupervise: false,
        canExport: false,
        canManageUsers: false,
      },
    },
  });

  // Create departments
await prisma.role.upsert({
    where: { code: 'MOPC' },
    update: {},
    create: {
      name: 'Ministerio de Obras Públicas y Comunicaciones',
      code: 'MOPC',
      isActive: true,
    },
  });

await prisma.role.upsert({
    where: { code: 'LEGAL' },
    update: {},
    create: {
      name: 'Departamento Jurídico',
      code: 'LEGAL',
      parentId: _mainDepartment.id,
      isActive: true,
    },
  });

await prisma.role.upsert({
    where: { code: 'TECHNICAL' },
    update: {},
    create: {
      name: 'Departamento Técnico',
      code: 'TECHNICAL',
      parentId: _mainDepartment.id,
      isActive: true,
    },
  });

  // Create users
  const hashedPassword = await bcrypt.hash('admin123', 12);

await prisma.role.upsert({
    where: { email: 'admin@mopc.gob.do' },
    update: {},
    create: {
      email: 'admin@mopc.gob.do',
      username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '809-555-0100',
      departmentId: _mainDepartment.id,
      roleId: _superAdminRole.id,
      isActive: true,
    },
  });

await prisma.role.upsert({
    where: { email: 'dept.admin@mopc.gob.do' },
    update: {},
    create: {
      email: 'dept.admin@mopc.gob.do',
      username: 'dept_admin',
      passwordHash: hashedPassword,
      firstName: 'Dept',
      lastName: 'Admin',
      phone: '809-555-0101',
      departmentId: _legalDept.id,
      roleId: _deptAdminRole.id,
      isActive: true,
    },
  });

await prisma.role.upsert({
    where: { email: 'analyst@mopc.gob.do' },
    update: {},
    create: {
      email: 'analyst@mopc.gob.do',
      username: 'analyst',
      passwordHash: hashedPassword,
      firstName: 'Juan',
      lastName: 'Analista',
      phone: '809-555-0102',
      departmentId: _legalDept.id,
      roleId: _analystRole.id,
      isActive: true,
    },
  });

  // Create system configuration
  await prisma.systemConfig.upsert({
    where: { key: 'app_version' },
    update: {},
    create: {
      key: 'app_version',
      value: '1.0.0',
      type: 'string',
      category: 'system',
      description: 'Versión actual de la aplicación',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'max_file_size' },
    update: {},
    create: {
      key: 'max_file_size',
      value: '10485760',
      type: 'number',
      category: 'upload',
      description: 'Tamaño máximo de archivo en bytes (10MB)',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'allowed_file_types' },
    update: {},
    create: {
      key: 'allowed_file_types',
      value: 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png',
      type: 'json',
      category: 'upload',
      description: 'Tipos de archivo permitidos para subida',
    },
  });

  // Create the 17 workflow stages
  const stages = [
    {
      stage: CaseStage.RECEPCION_SOLICITUD,
      name: 'Recepción de Solicitud',
      description: 'Recepción inicial de la solicitud de expropiación y verificación básica',
      sequenceOrder: 1,
      responsibleDepartment: 'MOPC',
      estimatedDuration: 2,
      requiredDocuments: ['solicitud_formal', 'identificacion_solicitante', 'poder_notarial'],
      validationRules: { requiresValidRequest: true, requiresApplicantId: true },
      autoAssignmentRules: { assignToDepartment: 'MOPC', assignByRole: 'department_admin' }
    },
    {
      stage: CaseStage.VERIFICACION_REQUISITOS,
      name: 'Verificación de Requisitos',
      description: 'Verificación completa de todos los requisitos legales y técnicos',
      sequenceOrder: 2,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 5,
      requiredDocuments: ['titulo_propiedad', 'certificado_registro', 'planos'],
      validationRules: { requiresAllDocuments: true, requiresLegalReview: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.CARGA_DOCUMENTOS,
      name: 'Carga Inicial de Documentos',
      description: 'Carga y verificación de todos los documentos requeridos',
      sequenceOrder: 3,
      responsibleDepartment: 'MOPC',
      estimatedDuration: 3,
      requiredDocuments: ['documentacion_completa', 'fotos_propiedad', 'valor_catastral'],
      validationRules: { requiresDocumentUpload: true, requiresValidation: true },
      autoAssignmentRules: { assignToDepartment: 'MOPC', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.ASIGNACION_ANALISTA,
      name: 'Asignación de Analista',
      description: 'Asignación del analista principal que manejará el caso',
      sequenceOrder: 4,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 1,
      requiredDocuments: ['expedido_caso'],
      validationRules: { requiresAvailableAnalyst: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'department_admin', autoAssign: true }
    },
    {
      stage: CaseStage.ANALISIS_PRELIMINAR,
      name: 'Análisis Preliminar',
      description: 'Análisis inicial del caso y evaluación de viabilidad',
      sequenceOrder: 5,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 7,
      requiredDocuments: ['informe_preliminar'],
      validationRules: { requiresAnalysisReport: true, requiresLegalCheck: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.NOTIFICACION_PROPIETARIO,
      name: 'Notificación al Propietario',
      description: 'Notificación oficial al propietario sobre el proceso de expropiación',
      sequenceOrder: 6,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 10,
      requiredDocuments: ['notificacion_oficial', 'acuse_recibo'],
      validationRules: { requiresOfficialNotification: true, requiresProofDelivery: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.PERITAJE_TECNICO,
      name: 'Peritaje Técnico',
      description: 'Evaluación técnica completa de la propiedad y sus características',
      sequenceOrder: 7,
      responsibleDepartment: 'TECHNICAL',
      estimatedDuration: 15,
      requiredDocuments: ['informe_pericial', 'fotos_tecnicas', 'mediciones'],
      validationRules: { requiresTechnicalReport: true, requiresExpertSignature: true },
      autoAssignmentRules: { assignToDepartment: 'TECHNICAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.DETERMINACION_VALOR,
      name: 'Determinación de Valor',
      description: 'Determinación del valor justo de compensación',
      sequenceOrder: 8,
      responsibleDepartment: 'TECHNICAL',
      estimatedDuration: 10,
      requiredDocuments: ['valoracion_completa', 'comparativo_mercado'],
      validationRules: { requiresValuationReport: true, requiresMarketAnalysis: true },
      autoAssignmentRules: { assignToDepartment: 'TECHNICAL', assignByRole: 'supervisor' }
    },
    {
      stage: CaseStage.OFERTA_COMPRA,
      name: 'Oferta de Compra',
      description: 'Elaboración y presentación de la oferta de compra',
      sequenceOrder: 9,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 5,
      requiredDocuments: ['oferta_compra', 'justificacion_valor'],
      validationRules: { requiresOfferDocument: true, requiresManagementApproval: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'department_admin' }
    },
    {
      stage: CaseStage.NEGOCIACION,
      name: 'Negociación',
      description: 'Proceso de negociación con el propietario',
      sequenceOrder: 10,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 20,
      requiredDocuments: ['actas_negociacion', 'contrapropuestas'],
      validationRules: { requiresNegotiationRecord: true, requiresMinOneMeeting: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'supervisor' }
    },
    {
      stage: CaseStage.APROBACION_ACUERDO,
      name: 'Aprobación de Acuerdo',
      description: 'Aprobación final del acuerdo de compensación',
      sequenceOrder: 11,
      responsibleDepartment: 'MOPC',
      estimatedDuration: 7,
      requiredDocuments: ['acuerdo_firmado', 'aprobacion_superior'],
      validationRules: { requiresSignedAgreement: true, requiresHighLevelApproval: true },
      autoAssignmentRules: { assignToDepartment: 'MOPC', assignByRole: 'super_admin' }
    },
    {
      stage: CaseStage.ELABORACION_ESCRITURA,
      name: 'Elaboración de Escritura',
      description: 'Elaboración de la escritura de traspaso',
      sequenceOrder: 12,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 10,
      requiredDocuments: ['escritura_borrador', 'revision_legal'],
      validationRules: { requiresDraftDeed: true, requiresLegalReview: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.FIRMA_DOCUMENTOS,
      name: 'Firma de Documentos',
      description: 'Firma oficial de todos los documentos legales',
      sequenceOrder: 13,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 5,
      requiredDocuments: ['escritura_firmada', 'testimonios'],
      validationRules: { requiresSignedDocuments: true, requiresNotarySignature: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'department_admin' }
    },
    {
      stage: CaseStage.REGISTRO_PROPIEDAD,
      name: 'Registro de Propiedad',
      description: 'Registro del cambio de propiedad en el Registro de Títulos',
      sequenceOrder: 14,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 15,
      requiredDocuments: ['certificado_registro', 'nuevo_titulo'],
      validationRules: { requiresRegistryCertificate: true, requiresNewTitle: true },
      autoAssignmentRules: { assignToDepartment: 'LEGAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.DESEMBOLSO_PAGO,
      name: 'Desembolso de Pago',
      description: 'Procesamiento y desembolso del pago de compensación',
      sequenceOrder: 15,
      responsibleDepartment: 'MOPC',
      estimatedDuration: 10,
      requiredDocuments: ['orden_pago', 'comprobante_pago'],
      validationRules: { requiresPaymentOrder: true, requiresPaymentProof: true },
      autoAssignmentRules: { assignToDepartment: 'MOPC', assignByRole: 'department_admin' }
    },
    {
      stage: CaseStage.ENTREGA_INMUEBLE,
      name: 'Entrega de Inmueble',
      description: 'Entrega física del inmueble y acta de recepción',
      sequenceOrder: 16,
      responsibleDepartment: 'TECHNICAL',
      estimatedDuration: 3,
      requiredDocuments: ['acta_entrega', 'fotos_entrega'],
      validationRules: { requiresDeliveryAct: true, requiresPropertyInspection: true },
      autoAssignmentRules: { assignToDepartment: 'TECHNICAL', assignByRole: 'analyst' }
    },
    {
      stage: CaseStage.CIERRE_ARCHIVO,
      name: 'Cierre y Archivo',
      description: 'Cierre final del caso y archivo documental',
      sequenceOrder: 17,
      responsibleDepartment: 'MOPC',
      estimatedDuration: 5,
      requiredDocuments: ['resumen_final', 'documentacion_archivada'],
      validationRules: { requiresFinalSummary: true, requiresCompleteArchive: true },
      autoAssignmentRules: { assignToDepartment: 'MOPC', assignByRole: 'department_admin' }
    }
  ];

  for (const stageConfig of stages) {
    await prisma.stage.upsert({
      where: { stage: stageConfig.stage },
      update: {
        name: stageConfig.name,
        description: stageConfig.description,
        sequenceOrder: stageConfig.sequenceOrder,
        responsibleDepartment: stageConfig.responsibleDepartment,
        estimatedDuration: stageConfig.estimatedDuration,
        requiredDocuments: stageConfig.requiredDocuments,
        validationRules: stageConfig.validationRules,
        autoAssignmentRules: stageConfig.autoAssignmentRules,
      },
      create: {
        stage: stageConfig.stage,
        name: stageConfig.name,
        description: stageConfig.description,
        sequenceOrder: stageConfig.sequenceOrder,
        responsibleDepartment: stageConfig.responsibleDepartment,
        estimatedDuration: stageConfig.estimatedDuration,
        requiredDocuments: stageConfig.requiredDocuments,
        validationRules: stageConfig.validationRules,
        autoAssignmentRules: stageConfig.autoAssignmentRules,
      },
    });
  }

  // Create checklists for each stage
  const checklistItems = [
    // Recepción de Solicitud
    { stage: CaseStage.RECEPCION_SOLICITUD, title: 'Verificar solicitud formal', itemType: 'DOCUMENT', sequence: 1 },
    { stage: CaseStage.RECEPCION_SOLICITUD, title: 'Validar identificación del solicitante', itemType: 'VERIFICATION', sequence: 2 },
    { stage: CaseStage.RECEPCION_SOLICITUD, title: 'Revisar poder notarial', itemType: 'DOCUMENT', sequence: 3 },

    // Verificación de Requisitos
    { stage: CaseStage.VERIFICACION_REQUISITOS, title: 'Verificar título de propiedad', itemType: 'DOCUMENT', sequence: 1 },
    { stage: CaseStage.VERIFICACION_REQUISITOS, title: 'Validar certificado de registro', itemType: 'DOCUMENT', sequence: 2 },
    { stage: CaseStage.VERIFICACION_REQUISITOS, title: 'Revisar planos actualizados', itemType: 'DOCUMENT', sequence: 3 },

    // Carga de Documentos
    { stage: CaseStage.CARGA_DOCUMENTOS, title: 'Subir documentación completa', itemType: 'DOCUMENT', sequence: 1 },
    { stage: CaseStage.CARGA_DOCUMENTOS, title: 'Adjuntar fotos de la propiedad', itemType: 'DOCUMENT', sequence: 2 },
    { stage: CaseStage.CARGA_DOCUMENTOS, title: 'Incluir valor catastral', itemType: 'DOCUMENT', sequence: 3 },

    // ... Add more checklist items for other stages
  ];

  for (const item of checklistItems) {
    await prisma.stageChecklist.upsert({
      where: {
        stage_sequence: {
          stage: item.stage,
          sequence: item.sequence!
        }
      },
      update: {
        title: item.title,
        itemType: item.itemType,
        isRequired: true,
        isActive: true,
      },
      create: {
        stage: item.stage,
        title: item.title,
        itemType: item.itemType,
        isRequired: true,
        isActive: true,
        sequence: item.sequence,
      },
    });
  }

  // Sample cases will be created later after authentication is tested

  logger.info(`✅ Database seeding completed successfully!

👤 Created users:
   - admin@mopc.gob.do / admin123 (Super Admin)
   - dept.admin@mopc.gob.do / admin123 (Department Admin)
   - analyst@mopc.gob.do / admin123 (Analyst)

🏢 Created departments:
   - MOPC (Main)
   - LEGAL (Child of MOPC)
   - TECHNICAL (Child of MOPC)

⚙️ Created system configuration
📋 Sample cases will be created later`);
}

main()
  .catch((e) => {
    logger.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });