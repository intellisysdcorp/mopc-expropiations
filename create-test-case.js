
import { PrismaClient } from "@prisma/client";
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

async function createTestCase() {
  try {
    const testCase = await prisma.case.create({
      data: {
        fileNumber: "TEST-001",
        title: "Caso de Prueba para Document Upload",
        description: "Este es un caso de prueba para verificar la funcionalidad de subida de documentos",
        currentStage: "RECEPCION_SOLICITUD",
        priority: "MEDIUM",
        status: "PENDIENTE",
        startDate: new Date(),
        propertyAddress: "Calle de Prueba #123",
        propertyCity: "Santo Domingo",
        propertyProvince: "Distrito Nacional",
        ownerName: "Propietario de Prueba",
        estimatedValue: 1000000,
        currency: "DOP",
        progressPercentage: 0,
        departmentId: "dept-mopc-main",
        createdById: "user-admin",
      },
    });

    logger.info("Test case created:", testCase);
    logger.info("Case ID:", testCase.id);
    return testCase;
  } catch (error) {
    logger.error("Error creating test case:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCase();

