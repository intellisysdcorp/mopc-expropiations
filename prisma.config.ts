import 'dotenv/config'
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

const databaseUrl = constructDatabaseUrl();

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { 
    url: databaseUrl 
  }
} satisfies PrismaConfig;

/**
 * Constructs a database URL from environment variables with proper URL encoding
 * to handle special characters in passwords and other values.
 */
function constructDatabaseUrl(): string {
  const user = env("DATABASE_USER");
  const password = env("DATABASE_PASSWORD");
  const host = env("DATABASE_HOST");
  const port = env("DATABASE_PORT");
  const database = env("DATABASE_NAME");

  // URL encode select components to handle special characters
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);

  return `mysql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
}
