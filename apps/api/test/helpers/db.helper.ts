import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const TEST_DATABASE_URL =
  "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public";

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined as any;
  }
}

export async function resetDatabase(): Promise<void> {
  const db = getTestPrisma();

  // Dynamically find all application tables and truncate them
  const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
  `);

  if (tables.length > 0) {
    const names = tables.map((t) => `"${t.tablename}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
  }

  // Re-seed
  execSync("npx prisma db seed", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
