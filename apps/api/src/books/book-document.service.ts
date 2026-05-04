import { Injectable, Logger } from "@nestjs/common";
import { IndexStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentContentService } from "../storage/document-content.service";

const MIN_BOOK_TEXT_CHARS = 200;

export interface BookPdfContent {
  title: string | null;
  authors: string[];
  description: string | null;
  category: string | null;
  publicationYear: number | null;
  publisher: string | null;
  pageCount: number | null;
  text: string;
}

@Injectable()
export class BookDocumentService {
  private readonly logger = new Logger(BookDocumentService.name);
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentContent: DocumentContentService,
  ) {}

  async indexBookPdf(bookId: string): Promise<void> {
    const existing = this.inFlight.get(bookId);
    if (existing) {
      await existing;
      return;
    }

    const work = this.doIndexBookPdf(bookId).finally(() => {
      this.inFlight.delete(bookId);
    });

    this.inFlight.set(bookId, work);
    await work;
  }

  async getPdfDocumentContent(url: string): Promise<BookPdfContent | null> {
    const book = await this.prisma.book.findFirst({
      where: {
        OR: [{ pdfUrl: url }, { ebookUrl: url }],
      },
      select: {
        id: true,
        title: true,
        authors: true,
        description: true,
        category: true,
        publicationYear: true,
        publisher: true,
        pdfUrl: true,
        pdfExtractedText: true,
        pdfIndexStatus: true,
        pdfPageCount: true,
      },
    });

    if (book?.pdfUrl === url && !book.pdfExtractedText) {
      await this.indexBookPdf(book.id);
    }

    const refreshedBook = book?.pdfUrl === url
      ? await this.prisma.book.findUnique({
          where: { id: book.id },
          select: {
            title: true,
            authors: true,
            description: true,
            category: true,
            publicationYear: true,
            publisher: true,
            pdfExtractedText: true,
            pdfPageCount: true,
          },
        })
      : null;

    if (refreshedBook?.pdfExtractedText) {
      return {
        title: refreshedBook.title,
        authors: refreshedBook.authors,
        description: refreshedBook.description,
        category: refreshedBook.category,
        publicationYear: refreshedBook.publicationYear,
        publisher: refreshedBook.publisher,
        pageCount: refreshedBook.pdfPageCount,
        text: refreshedBook.pdfExtractedText,
      };
    }

    if (!this.documentContent.isSupportedDocument(url) || this.documentContent.getExtension(url) !== ".pdf") {
      return null;
    }

    const extracted = await this.documentContent.extractFromFileUrl(url);
    if (extracted.text.trim().length < MIN_BOOK_TEXT_CHARS) {
      return null;
    }

    return {
      title: book?.title ?? null,
      authors: book?.authors ?? [],
      description: book?.description ?? null,
      category: book?.category ?? null,
      publicationYear: book?.publicationYear ?? null,
      publisher: book?.publisher ?? null,
      pageCount: extracted.pageCount,
      text: extracted.text,
    };
  }

  private async doIndexBookPdf(bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, pdfUrl: true },
    });

    if (!book) {
      this.logger.warn(`Book ${bookId} not found for PDF indexing`);
      return;
    }

    if (!book.pdfUrl) {
      await this.prisma.book.update({
        where: { id: bookId },
        data: {
          pdfIndexStatus: IndexStatus.NOT_APPLICABLE,
          pdfExtractedText: null,
          pdfIndexedAt: null,
          pdfPageCount: null,
        },
      });
      return;
    }

    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        pdfIndexStatus: IndexStatus.PROCESSING,
        pdfExtractedText: null,
      },
    });

    try {
      const extracted = await this.documentContent.extractFromFileUrl(book.pdfUrl);

      if (extracted.text.trim().length < MIN_BOOK_TEXT_CHARS) {
        await this.prisma.book.update({
          where: { id: bookId },
          data: {
            pdfIndexStatus: IndexStatus.FAILED,
            pdfExtractedText: null,
            pdfIndexedAt: null,
            pdfPageCount: extracted.pageCount,
          },
        });
        return;
      }

      await this.prisma.book.update({
        where: { id: bookId },
        data: {
          pdfExtractedText: extracted.text,
          pdfIndexStatus: IndexStatus.INDEXED,
          pdfIndexedAt: new Date(),
          pdfPageCount: extracted.pageCount,
        },
      });
    } catch (error) {
      this.logger.error(`Book PDF indexing failed for ${bookId}: ${String(error)}`);
      await this.prisma.book.update({
        where: { id: bookId },
        data: {
          pdfIndexStatus: IndexStatus.FAILED,
          pdfExtractedText: null,
        },
      });
    }
  }
}
