import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { BooksModule } from "./books/books.module";
import { BorrowsModule } from "./borrows/borrows.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MaterialsModule } from "./materials/materials.module";
import { ReadingListsModule } from "./reading-lists/reading-lists.module";
import { InstructorFollowersModule } from "./instructor-followers/instructor-followers.module";
import { AiModule } from "./ai/ai.module";
import { StorageModule } from "./storage/storage.module";
import { HealthModule } from "./health/health.module";
import { BranchesModule } from "./branches/branches.module";
import { BorrowPoliciesModule } from "./borrow-policies/borrow-policies.module";
import { FinePaymentsModule } from "./fine-payments/fine-payments.module";
import { ReportsModule } from "./reports/reports.module";
import { ExternalBooksModule } from "./external-books/external-books.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: parseInt(config.get("THROTTLE_TTL", "60"), 10) * 1000,
            limit: parseInt(config.get("THROTTLE_LIMIT", "20"), 10),
          },
        ],
      }),
    }),
    StorageModule,
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    BooksModule,
    BorrowsModule,
    ReservationsModule,
    DashboardModule,
    NotificationsModule,
    MaterialsModule,
    ReadingListsModule,
    InstructorFollowersModule,
    AiModule,
    HealthModule,
    BranchesModule,
    BorrowPoliciesModule,
    FinePaymentsModule,
    ReportsModule,
    ExternalBooksModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes("*");
  }
}
