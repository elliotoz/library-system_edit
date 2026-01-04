// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const isDocker = process.env.DOCKER_ENV === 'true';
    const dbHost = process.env.POSTGRES_HOST || (isDocker ? 'postgres' : 'localhost');
    const dbUser = process.env.POSTGRES_USER || 'library_admin';
    const dbPass = process.env.POSTGRES_PASSWORD || 'library_password_2024';
    const dbName = process.env.POSTGRES_DB || 'library_system';
    const dbPort = process.env.POSTGRES_PORT || '5432';
    const databaseUrl =
      process.env.DATABASE_URL ||
      `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?schema=public`;

    super({
      datasources: { db: { url: databaseUrl } },
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('📦 Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('📦 Prisma disconnected from database');
  }
}
