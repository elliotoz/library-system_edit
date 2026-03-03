import { Module } from '@nestjs/common';
import { ReadingListsService } from './reading-lists.service';
import { ReadingListsController } from './reading-lists.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReadingListsController],
  providers: [ReadingListsService],
  exports: [ReadingListsService],
})
export class ReadingListsModule {}
