import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isDocker = process.env.DOCKER_ENV === "true";
    const dbHost = process.env.POSTGRES_HOST || (isDocker ? "postgres" : "localhost");
    const dbUser = process.env.POSTGRES_USER || "library_admin";
    const dbPass = process.env.POSTGRES_PASSWORD || "library_password_2024";
    const dbName = process.env.POSTGRES_DB || "library_system";
    const dbPort = process.env.POSTGRES_PORT || "5432";
    const databaseUrl =
      process.env.DATABASE_URL ||
      `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?schema=public`;
    const enableSqlLogging = process.env.LOG_SQL === "true";

    super({
      datasources: { db: { url: databaseUrl } },
      log: enableSqlLogging ? ["query", "warn", "error"] : ["warn", "error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(JSON.stringify({ event: "prisma.connected", service: "library-api" }));
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log(JSON.stringify({ event: "prisma.disconnected", service: "library-api" }));
  }
}
