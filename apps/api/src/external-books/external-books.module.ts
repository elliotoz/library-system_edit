import { Module } from '@nestjs/common';
import { ExternalBooksService } from './external-books.service';
import { ExternalBooksController } from './external-books.controller';

@Module({
  controllers: [ExternalBooksController],
  providers: [ExternalBooksService],
})
export class ExternalBooksModule {}
