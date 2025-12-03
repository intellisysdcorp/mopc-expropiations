import "dotenv/config";
import { defineConfig } from "prisma/config";

// Construct DATABASE_URL from individual variables
const databaseUrl = `mysql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`;

export default defineConfig({
   schema: "prisma/schema.prisma",
   migrations: {
     path: "prisma/migrations"
   },
   datasource: {
      url: databaseUrl,
   },
});
