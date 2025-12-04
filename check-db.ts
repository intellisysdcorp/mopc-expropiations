import { PrismaClient } from "@prisma/client";
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

async function checkDb() {
  try {
    const departments = await prisma.department.findMany();
    logger.info("Departments:");
    departments.forEach(d => logger.info(`- ${d.id}: ${d.name}`));

    const users = await prisma.user.findMany();
    logger.info("\nUsers:");
    users.forEach(u => logger.info(`- ${u.id}: ${u.email}`));

    const cases = await prisma.case.findMany();
    logger.info("\nCases:");
    cases.forEach(c => logger.info(`- ${c.id}: ${c.fileNumber}`));

  } catch (error) {
    logger.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDb();