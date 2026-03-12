import { Module } from "@nestjs/common";
import { BorrowPoliciesController } from "./borrow-policies.controller";
import { BorrowPoliciesService } from "./borrow-policies.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BorrowPoliciesController],
  providers: [BorrowPoliciesService],
  exports: [BorrowPoliciesService],
})
export class BorrowPoliciesModule {}
