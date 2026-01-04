import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { BooksModule } from "./books/books.module";
import { BorrowsModule } from "./borrows/borrows.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MaterialsModule } from "./materials/materials.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BooksModule,
    BorrowsModule,
    ReservationsModule,
    DashboardModule,
    NotificationsModule,
    MaterialsModule,
  ],
})
export class AppModule {}
