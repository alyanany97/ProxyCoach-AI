import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../generated/prisma/client";

/**
 * Prisma client singleton with connection pooling
 * 
 * Uses PrismaPg adapter with pg Pool for better performance,
 * especially with Azure PostgreSQL. In development, uses a global
 * variable to prevent multiple instances during hot reloading.
 */
const globalForPrisma = globalThis as unknown as {
   pool?: Pool;
   prisma?: PrismaClient;
};

const pool =
   globalForPrisma.pool ??
   new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: (process.env.DATABASE_URL?.includes(".neon.tech") ||
         process.env.DATABASE_URL?.includes(".postgres.database.azure.com"))
         ? { rejectUnauthorized: false }
         : undefined,
   });

if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

export const prisma =
   globalForPrisma.prisma ??
   new PrismaClient({
      adapter: new PrismaPg(pool),
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
   });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

