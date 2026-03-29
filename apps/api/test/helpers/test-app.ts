import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { GlobalExceptionFilter } from "@/common/filters/global-exception.filter";
import { BorrowSchedulerService } from "@/borrows/borrow-scheduler.service";

let app: INestApplication;

export async function getApp(): Promise<INestApplication> {
  if (app) return app;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(BorrowSchedulerService)
    .useValue({ onModuleInit: () => {}, onModuleDestroy: () => {}, runChecks: async () => {} })
    .compile();

  app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = undefined as any;
  }
}
