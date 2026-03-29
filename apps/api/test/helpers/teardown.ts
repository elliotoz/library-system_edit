import { Client } from "pg";

export default async function globalTeardown() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "library_admin",
    password: "library_password_2024",
    database: "postgres",
  });

  await client.connect();

  await client.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'library_system_test'
      AND pid <> pg_backend_pid()
  `);

  await client.query("DROP DATABASE IF EXISTS library_system_test");
  await client.end();
}
