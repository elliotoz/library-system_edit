import { Injectable, Logger } from "@nestjs/common";
import { IndexStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DocumentContentService,
  ExtractedDocument,
  ExtractedParagraph,
} from "../storage/document-content.service";

const MIN_BOOK_TEXT_CHARS = 200;
const BOOK_CHUNK_WORDS = 700;
const BOOK_CHUNK_OVERLAP_WORDS = 80;
const MIN_BOOK_CHUNK_CHARS = 50;

interface BookChunkDraft {
  content: string;
  tokenCount: number;
  pageNumber: number | null;
}

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
        ebookUrl: true,
        pdfExtractedText: true,
        pdfIndexStatus: true,
        pdfPageCount: true,
      },
    });

    const readableUrl = book ? this.getReadablePdfUrl(book) : null;

    if (book && readableUrl === url && !book.pdfExtractedText) {
      await this.indexBookPdf(book.id);
    }

    const refreshedBook = book && readableUrl === url
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
      select: { id: true, title: true, pdfUrl: true, ebookUrl: true },
    });

    if (!book) {
      this.logger.warn(`Book ${bookId} not found for PDF indexing`);
      return;
    }

    const readableUrl = this.getReadablePdfUrl(book);

    if (!readableUrl) {
      await this.prisma.$transaction([
        this.prisma.bookChunk.deleteMany({ where: { bookId } }),
        this.prisma.book.update({
          where: { id: bookId },
          data: {
            pdfIndexStatus: IndexStatus.NOT_APPLICABLE,
            pdfExtractedText: null,
            pdfIndexedAt: null,
            pdfPageCount: null,
          },
        }),
      ]);
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
      const extracted = await this.documentContent.extractFromFileUrl(readableUrl);

      if (extracted.text.trim().length < MIN_BOOK_TEXT_CHARS) {
        await this.prisma.$transaction([
          this.prisma.bookChunk.deleteMany({ where: { bookId } }),
          this.prisma.book.update({
            where: { id: bookId },
            data: {
              pdfIndexStatus: IndexStatus.FAILED,
              pdfExtractedText: null,
              pdfIndexedAt: null,
              pdfPageCount: extracted.pageCount,
            },
          }),
        ]);
        return;
      }

      const chunks = this.buildChunks(extracted);

      await this.prisma.$transaction([
        this.prisma.bookChunk.deleteMany({ where: { bookId } }),
        this.prisma.bookChunk.createMany({
          data: chunks.map((chunk, chunkIndex) => ({
            bookId,
            chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            pageNumber: chunk.pageNumber,
          })),
        }),
        this.prisma.book.update({
          where: { id: bookId },
          data: {
            pdfExtractedText: extracted.text,
            pdfIndexStatus: IndexStatus.INDEXED,
            pdfIndexedAt: new Date(),
            pdfPageCount: extracted.pageCount,
          },
        }),
      ]);
    } catch (error) {
      this.logger.error(`Book PDF indexing failed for ${bookId}: ${String(error)}`);
      await this.prisma.$transaction([
        this.prisma.bookChunk.deleteMany({ where: { bookId } }),
        this.prisma.book.update({
          where: { id: bookId },
          data: {
            pdfIndexStatus: IndexStatus.FAILED,
            pdfExtractedText: null,
            pdfIndexedAt: null,
          },
        }),
      ]);
    }
  }

  private getReadablePdfUrl(book: { pdfUrl: string | null; ebookUrl: string | null }): string | null {
    if (book.pdfUrl) return book.pdfUrl;
    if (book.ebookUrl && this.isPdfLikeUrl(book.ebookUrl)) return book.ebookUrl;
    return null;
  }

  private isPdfLikeUrl(url: string): boolean {
    const path = url.split("?")[0].split("#")[0].toLowerCase();
    return path.endsWith(".pdf");
  }

  private buildChunks(extracted: ExtractedDocument): BookChunkDraft[] {
    const sourceParagraphs = extracted.paragraphs.length > 0
      ? extracted.paragraphs
      : [{ text: extracted.text, pageNumber: null }];
    const chunks: Array<{ content: string; pageNumber: number | null }> = [];
    let currentWords: string[] = [];
    let currentPage: number | null = null;

    for (const para of sourceParagraphs as ExtractedParagraph[]) {
      const words = para.text.split(/\s+/).filter((word) => word.length > 0);
      if (words.length === 0) continue;

      if (
        currentWords.length > 0 &&
        currentWords.length + words.length > BOOK_CHUNK_WORDS
      ) {
        chunks.push({
          content: currentWords.join(" "),
          pageNumber: currentPage,
        });

        const overlap = currentWords.slice(-BOOK_CHUNK_OVERLAP_WORDS);
        currentWords = [...overlap, ...words];
        currentPage = para.pageNumber;
      } else {
        if (currentWords.length === 0) {
          currentPage = para.pageNumber;
        }
        currentWords.push(...words);
      }
    }

    if (currentWords.length > 0) {
      chunks.push({ content: currentWords.join(" "), pageNumber: currentPage });
    }

    return chunks
      .filter((chunk) => chunk.content.length >= MIN_BOOK_CHUNK_CHARS)
      .map((chunk) => ({
        ...chunk,
        tokenCount: Math.ceil(chunk.content.length / 4),
      }));
  }
}
