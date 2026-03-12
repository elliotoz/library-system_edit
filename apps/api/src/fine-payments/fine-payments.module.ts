import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinePaymentsController } from './fine-payments.controller';
import { FinePaymentsService } from './fine-payments.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinePaymentsController],
  providers: [FinePaymentsService],
  exports: [FinePaymentsService],
})
export class FinePaymentsModule {}
