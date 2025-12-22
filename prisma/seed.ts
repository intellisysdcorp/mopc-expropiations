import 'dotenv/config';
import { CaseStage } from '@/prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

async function main() {
  logger.info('🌱 Starting database seeding...');

  // Create roles
  const superAdminRole = await prisma.role.upsert({
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

  const deptAdminRole = await prisma.role.upsert({
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

  const analystRole = await prisma.role.upsert({
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
  const mainDepartment = await prisma.department.upsert({
    where: { code: 'MOPC' },
    update: {},
    create: {
      name: 'Ministerio de Obras Públicas y Comunicaciones',
      code: 'MOPC',
      isActive: true,
    },
  });

  // Create departments for the new workflow stages
  const newDepartments = [
    { code: 'AVALUOS', name: 'Departamento de Avalúos' },
    { code: 'CONTROL_INTERNO', name: 'Departamento de Control Interno' },
    { code: 'REVISION_ANALISIS', name: 'Departamento de Revisión y Análisis' },
    { code: 'DIRECCION_GENERAL', name: 'Dirección General Administrativa y Financiera' },
    { code: 'FINANCIERO', name: 'Departamento Financiero' },
    { code: 'CONTRALORIA', name: 'Contraloría General de la República' },
    { code: 'AUDITORIA_INTERNA', name: 'Unidad de Auditoría Interna' },
    { code: 'TESORERIA', name: 'Tesorería Nacional' },
    { code: 'SECCION_PAGOS', name: 'Sección de Pagos del MOPC' },
  ];

  for (const dept of newDepartments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: {
        name: dept.name,
        code: dept.code,
        parentId: mainDepartment.id,
        isActive: true,
      },
    });
  }

  // Create users
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@mopc.gob.do' },
    update: {},
    create: {
      email: 'admin@mopc.gob.do',
      username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '809-555-0100',
      departmentId: mainDepartment.id,
      roleId: superAdminRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dept.admin@mopc.gob.do' },
    update: {},
    create: {
      email: 'dept.admin@mopc.gob.do',
      username: 'dept_admin',
      passwordHash: hashedPassword,
      firstName: 'Dept',
      lastName: 'Admin',
      phone: '809-555-0101',
      departmentId: mainDepartment.id,
      roleId: deptAdminRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'analyst@mopc.gob.do' },
    update: {},
    create: {
      email: 'analyst@mopc.gob.do',
      username: 'analyst',
      passwordHash: hashedPassword,
      firstName: 'Juan',
      lastName: 'Analista',
      phone: '809-555-0102',
      departmentId: mainDepartment.id,
      roleId: analystRole.id,
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

  // Create the 13 workflow stages
  const stages = [
    {
      stage: CaseStage.AVALUO,
      name: 'Avalúo',
      description: 'Confirma existencia de título y evalúa valor de inmueble',
      sequenceOrder: 1,
      responsibleDepartment: 'AVALUOS',
      estimatedDuration: 10,
      requiredDocuments: ['titulo_propiedad', 'certificado_registro', 'planos'],
      validationRules: {
        requiresTitleConfirmation: true,
        requiresValuation: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'AVALUOS',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.REVISION_LEGAL,
      name: 'Revisión Legal',
      description: 'Revisa la legalidad del expediente',
      sequenceOrder: 2,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 7,
      requiredDocuments: ['informe_legal', 'documentacion_legal'],
      validationRules: { requiresLegalReview: true, requiresLegalReport: true },
      autoAssignmentRules: {
        assignToDepartment: 'LEGAL',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.CUMPLIMIENTO_NORMATIVO,
      name: 'Cumplimiento Normativo',
      description: 'Verificación de cumplimiento normativo y documentación',
      sequenceOrder: 3,
      responsibleDepartment: 'CONTROL_INTERNO',
      estimatedDuration: 5,
      requiredDocuments: ['checklist_normativo', 'informe_cumplimiento'],
      validationRules: {
        requiresComplianceCheck: true,
        requiresDocumentation: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'CONTROL_INTERNO',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.VALIDACION_TECNICA,
      name: 'Validación Técnica',
      description:
        'Analiza expediente y validación técnica, emite informe favorable',
      sequenceOrder: 4,
      responsibleDepartment: 'REVISION_ANALISIS',
      estimatedDuration: 8,
      requiredDocuments: ['informe_tecnico', 'validacion_expedito'],
      validationRules: {
        requiresTechnicalValidation: true,
        requiresFavorableReport: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'REVISION_ANALISIS',
        assignByRole: 'supervisor',
      },
    },
    {
      stage: CaseStage.VALIDACION_ADMINISTRATIVA,
      name: 'Validación Administrativa y Autorización de Ministro',
      description:
        'La Dirección General valida los aspectos financieros, coordina con el departamento correspondiente y escala la solicitud',
      sequenceOrder: 5,
      responsibleDepartment: 'DIRECCION_GENERAL',
      estimatedDuration: 10,
      requiredDocuments: [
        'validacion_financiera',
        'coordinacion_interna',
        'solicitud_ministro',
      ],
      validationRules: {
        requiresFinancialValidation: true,
        requiresCoordination: true,
        requiresMinisterialRequest: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'DIRECCION_GENERAL',
        assignByRole: 'department_admin',
      },
    },
    {
      stage: CaseStage.SANCION_INICIAL_MINISTRO,
      name: 'Sanción Inicial de Ministro',
      description:
        'El Ministro revisa el expediente, firma la autorización y lo remite nuevamente al Departamento Financiero',
      sequenceOrder: 6,
      responsibleDepartment: 'DIRECCION_GENERAL',
      estimatedDuration: 5,
      requiredDocuments: ['resolucion_ministro', 'firma_autorizacion'],
      validationRules: {
        requiresMinisterReview: true,
        requiresSignature: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'DIRECCION_GENERAL',
        assignByRole: 'super_admin',
      },
    },
    {
      stage: CaseStage.PROGRAMACION_PAGO,
      name: 'Programación de Pago',
      description: 'Programa pago y prepara documentación financiera',
      sequenceOrder: 7,
      responsibleDepartment: 'FINANCIERO',
      estimatedDuration: 7,
      requiredDocuments: ['programacion_pago', 'documentacion_financiera'],
      validationRules: {
        requiresPaymentSchedule: true,
        requiresFinancialDocumentation: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'FINANCIERO',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.REVISION_LEGAL_FINAL,
      name: 'Revisión Legal Final',
      description: 'Revisión legal final y redacción/revisión de contrato',
      sequenceOrder: 8,
      responsibleDepartment: 'LEGAL',
      estimatedDuration: 10,
      requiredDocuments: ['informe_legal_final', 'contrato_borrador'],
      validationRules: {
        requiresFinalLegalReview: true,
        requiresContractDraft: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'LEGAL',
        assignByRole: 'supervisor',
      },
    },
    {
      stage: CaseStage.CERTIFICACION_CONTRATO,
      name: 'Certificación de Contrato',
      description: 'Certifica contrato o expediente',
      sequenceOrder: 9,
      responsibleDepartment: 'CONTRALORIA',
      estimatedDuration: 15,
      requiredDocuments: ['contrato_firmado', 'certificacion_contraloria'],
      validationRules: {
        requiresSignedContract: true,
        requiresContraloriaCertification: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'CONTRALORIA',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.AUTORIZACION_PAGO,
      name: 'Autorización de Pago',
      description:
        'Revisa expediente certificado y elabora libramiento de pago',
      sequenceOrder: 10,
      responsibleDepartment: 'FINANCIERO',
      estimatedDuration: 5,
      requiredDocuments: ['expediente_certificado', 'libramiento_pago'],
      validationRules: {
        requiresCertifiedFile: true,
        requiresPaymentOrder: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'FINANCIERO',
        assignByRole: 'department_admin',
      },
    },
    {
      stage: CaseStage.REVISION_LIBRAMIENTO,
      name: 'Revisión de Libramiento',
      description: 'Revisa y valida libramiento de pago',
      sequenceOrder: 11,
      responsibleDepartment: 'AUDITORIA_INTERNA',
      estimatedDuration: 7,
      requiredDocuments: ['libramiento_revisado', 'informe_auditoria'],
      validationRules: {
        requiresPaymentOrderReview: true,
        requiresAuditReport: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'AUDITORIA_INTERNA',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.EMISION_PAGO,
      name: 'Emisión de Pago',
      description:
        'Emisión de cheque a beneficiario y envío de cheque a Sección de Pagos del MOPC',
      sequenceOrder: 12,
      responsibleDepartment: 'TESORERIA',
      estimatedDuration: 3,
      requiredDocuments: ['cheque_emitido', 'comprobante_emision'],
      validationRules: {
        requiresCheckIssued: true,
        requiresEmissionProof: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'TESORERIA',
        assignByRole: 'analyst',
      },
    },
    {
      stage: CaseStage.ENTREGA_CHEQUE,
      name: 'Entrega de Cheque',
      description:
        'Custodia y entrega el cheque, recoge acuse de recibo y remite expediente al Departamento de Avalúos',
      sequenceOrder: 13,
      responsibleDepartment: 'SECCION_PAGOS',
      estimatedDuration: 2,
      requiredDocuments: ['acuse_recibo', 'expediente_cerrado'],
      validationRules: {
        requiresReceiptProof: true,
        requiresFileClosure: true,
      },
      autoAssignmentRules: {
        assignToDepartment: 'SECCION_PAGOS',
        assignByRole: 'analyst',
      },
    },
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
    // Avalúo
    {
      stage: CaseStage.AVALUO,
      title: 'Confirmar existencia de título',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.AVALUO,
      title: 'Evaluar valor de inmueble',
      itemType: 'DOCUMENT',
      sequence: 2,
    },
    {
      stage: CaseStage.AVALUO,
      title: 'Elaborar informe de avalúo',
      itemType: 'DOCUMENT',
      sequence: 3,
    },

    // Revisión Legal
    {
      stage: CaseStage.REVISION_LEGAL,
      title: 'Revisar legalidad del expediente',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.REVISION_LEGAL,
      title: 'Validar documentación legal',
      itemType: 'DOCUMENT',
      sequence: 2,
    },

    // Cumplimiento Normativo
    {
      stage: CaseStage.CUMPLIMIENTO_NORMATIVO,
      title: 'Verificar cumplimiento normativo',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.CUMPLIMIENTO_NORMATIVO,
      title: 'Validar documentación requerida',
      itemType: 'DOCUMENT',
      sequence: 2,
    },

    // Validación Técnica
    {
      stage: CaseStage.VALIDACION_TECNICA,
      title: 'Analizar expediente técnico',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.VALIDACION_TECNICA,
      title: 'Realizar validación técnica',
      itemType: 'VERIFICATION',
      sequence: 2,
    },
    {
      stage: CaseStage.VALIDACION_TECNICA,
      title: 'Emitir informe favorable',
      itemType: 'DOCUMENT',
      sequence: 3,
    },

    // Validación Administrativa y Autorización de Ministro
    {
      stage: CaseStage.VALIDACION_ADMINISTRATIVA,
      title: 'Validar aspectos financieros',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.VALIDACION_ADMINISTRATIVA,
      title: 'Coordinar con departamento correspondiente',
      itemType: 'ACTION',
      sequence: 2,
    },
    {
      stage: CaseStage.VALIDACION_ADMINISTRATIVA,
      title: 'Escalar solicitud a ministro',
      itemType: 'DOCUMENT',
      sequence: 3,
    },

    // Sanción Inicial de Ministro
    {
      stage: CaseStage.SANCION_INICIAL_MINISTRO,
      title: 'Revisar expediente completo',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.SANCION_INICIAL_MINISTRO,
      title: 'Firmar autorización ministerial',
      itemType: 'DOCUMENT',
      sequence: 2,
    },
    {
      stage: CaseStage.SANCION_INICIAL_MINISTRO,
      title: 'Remitir al Departamento Financiero',
      itemType: 'ACTION',
      sequence: 3,
    },

    // Programación de Pago
    {
      stage: CaseStage.PROGRAMACION_PAGO,
      title: 'Programar fecha de pago',
      itemType: 'ACTION',
      sequence: 1,
    },
    {
      stage: CaseStage.PROGRAMACION_PAGO,
      title: 'Preparar documentación financiera',
      itemType: 'DOCUMENT',
      sequence: 2,
    },

    // Revisión Legal Final
    {
      stage: CaseStage.REVISION_LEGAL_FINAL,
      title: 'Realizar revisión legal final',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.REVISION_LEGAL_FINAL,
      title: 'Redactar contrato',
      itemType: 'DOCUMENT',
      sequence: 2,
    },
    {
      stage: CaseStage.REVISION_LEGAL_FINAL,
      title: 'Revisar contrato',
      itemType: 'VERIFICATION',
      sequence: 3,
    },

    // Certificación de Contrato
    {
      stage: CaseStage.CERTIFICACION_CONTRATO,
      title: 'Certificar contrato',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.CERTIFICACION_CONTRATO,
      title: 'Certificar expediente completo',
      itemType: 'DOCUMENT',
      sequence: 2,
    },

    // Autorización de Pago
    {
      stage: CaseStage.AUTORIZACION_PAGO,
      title: 'Revisar expediente certificado',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.AUTORIZACION_PAGO,
      title: 'Elaborar libramiento de pago',
      itemType: 'DOCUMENT',
      sequence: 2,
    },

    // Revisión de Libramiento
    {
      stage: CaseStage.REVISION_LIBRAMIENTO,
      title: 'Revisar libramiento de pago',
      itemType: 'VERIFICATION',
      sequence: 1,
    },
    {
      stage: CaseStage.REVISION_LIBRAMIENTO,
      title: 'Validar libramiento',
      itemType: 'VERIFICATION',
      sequence: 2,
    },

    // Emisión de Pago
    {
      stage: CaseStage.EMISION_PAGO,
      title: 'Emitir cheque a beneficiario',
      itemType: 'DOCUMENT',
      sequence: 1,
    },
    {
      stage: CaseStage.EMISION_PAGO,
      title: 'Enviar cheque a Sección de Pagos',
      itemType: 'ACTION',
      sequence: 2,
    },

    // Entrega de Cheque
    {
      stage: CaseStage.ENTREGA_CHEQUE,
      title: 'Custodiar cheque',
      itemType: 'ACTION',
      sequence: 1,
    },
    {
      stage: CaseStage.ENTREGA_CHEQUE,
      title: 'Entregar cheque',
      itemType: 'VERIFICATION',
      sequence: 2,
    },
    {
      stage: CaseStage.ENTREGA_CHEQUE,
      title: 'Recoger acuse de recibo',
      itemType: 'DOCUMENT',
      sequence: 3,
    },
    {
      stage: CaseStage.ENTREGA_CHEQUE,
      title: 'Remitir expediente al Departamento de Avalúos',
      itemType: 'ACTION',
      sequence: 4,
    },
  ];

  for (const item of checklistItems) {
    await prisma.stageChecklist.upsert({
      where: {
        stage_sequence: {
          stage: item.stage,
          sequence: item.sequence!,
        },
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
