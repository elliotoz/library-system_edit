import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { BookDocumentService } from './book-document.service';
import { BookContentSearchService } from './book-content-search.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, BookDocumentService, BookContentSearchService],
  exports: [BooksService, BookDocumentService, BookContentSearchService],
})
export class BooksModule {}
