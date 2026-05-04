import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { BookDocumentService } from './book-document.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, BookDocumentService],
  exports: [BooksService, BookDocumentService],
})
export class BooksModule {}
