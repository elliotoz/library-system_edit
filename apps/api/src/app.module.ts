import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, RequestLoggerMiddleware)
      .forRoutes("*");
  }
}
