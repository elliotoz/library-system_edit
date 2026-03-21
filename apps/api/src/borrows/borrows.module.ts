import { Module } from '@nestjs/common';
import { BorrowsService } from './borrows.service';
import { BorrowsController } from './borrows.controller';
import { BorrowSchedulerService } from './borrow-scheduler.service';

@Module({
  controllers: [BorrowsController],
  providers: [BorrowsService, BorrowSchedulerService],
  exports: [BorrowsService],
})
export class BorrowsModule {}