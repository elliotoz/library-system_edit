import { execSync } from "child_process";
import { Client } from "pg";

export default async function globalSetup() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "library_admin",
    password: "library_password_2024",
    database: "postgres",
  });

  await client.connect();

  const dbExists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'library_system_test'"
  );

  if (dbExists.rowCount === 0) {
    await client.query("CREATE DATABASE library_system_test");
  }

  await client.end();

  const env = {
    ...process.env,
    DATABASE_URL:
      "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public",
  };

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  });

  execSync("npx prisma db seed", {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  });
}
