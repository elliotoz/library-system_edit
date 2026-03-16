import { Injectable, ConflictException, Logger } from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { ImportBookDto, NormalizedBook } from './dto/external-books.dto';

@Injectable()
export class ExternalBooksService {
  private readonly logger = new Logger(ExternalBooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public methods ─────────────────────────────────────────────

  async search(q: string): Promise<NormalizedBook[]> {
    const [openLibrary, gutendex] = await Promise.allSettled([
      this.fetchOpenLibraryBooks(q),
      this.fetchGutendexBooks(q),
    ]);

    const results: NormalizedBook[] = [];

    if (openLibrary.status === 'fulfilled') {
      results.push(...openLibrary.value);
    } else {
      this.logger.warn(`Open Library search failed: ${(openLibrary as PromiseRejectedResult).reason}`);
    }

    if (gutendex.status === 'fulfilled') {
      results.push(...gutendex.value);
    } else {
      this.logger.warn(`Gutendex search failed: ${(gutendex as PromiseRejectedResult).reason}`);
    }

    return results;
  }

  async importBook(dto: ImportBookDto) {
    if (dto.isbn) {
      const existing = await this.prisma.book.findUnique({
        where: { isbn: dto.isbn },
      });
      if (existing) {
        throw new ConflictException(
          `A book with ISBN ${dto.isbn} already exists in the catalog.`,
        );
      }
    }

    return this.prisma.book.create({
      data: {
        title: dto.title,
        authors: dto.authors,
        description: dto.description ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        ebookUrl: dto.ebookUrl ?? null,
        source: dto.source,
        isbn: dto.isbn ?? null,
        publicationYear: dto.publicationYear ?? null,
        isEbookAvailable: true,
      },
    });
  }

  async bulkImportGutendex(): Promise<{ imported: number; skipped: number }> {
    // Fetch 4 pages concurrently (Gutendex returns ~32 per page = up to 128, take first 100)
    const pages = await Promise.allSettled([
      this.fetchRawGutendexPage(1),
      this.fetchRawGutendexPage(2),
      this.fetchRawGutendexPage(3),
      this.fetchRawGutendexPage(4),
    ]);

    const allBooks: NormalizedBook[] = [];
    for (const page of pages) {
      if (page.status === 'fulfilled') {
        allBooks.push(...this.normalizeGutendexResults(page.value));
      }
    }

    let imported = 0;
    let skipped = 0;

    for (const book of allBooks.slice(0, 100)) {
      try {
        await this.importBook(book as ImportBookDto);
        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // ── Fetch helpers ──────────────────────────────────────────────

  private async fetchOpenLibraryBooks(q: string): Promise<NormalizedBook[]> {
    const url =
      `https://openlibrary.org/search.json` +
      `?q=${encodeURIComponent(q)}&limit=15` +
      `&fields=title,author_name,isbn,cover_i,first_publish_year,key`;

    const data = await this.httpGet(url);

    return (data.docs ?? []).map((doc: any): NormalizedBook => ({
      title: doc.title || 'Untitled',
      authors: Array.isArray(doc.author_name) ? doc.author_name : [],
      coverImageUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : undefined,
      ebookUrl: doc.key ? `https://openlibrary.org${doc.key}` : undefined,
      source: 'OpenLibrary',
      isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : undefined,
      publicationYear: doc.first_publish_year ?? undefined,
    }));
  }

  private async fetchGutendexBooks(q: string): Promise<NormalizedBook[]> {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(q)}`;
    const data = await this.httpGet(url);
    return this.normalizeGutendexResults(data.results ?? []);
  }

  private async fetchRawGutendexPage(page: number): Promise<any[]> {
    const url = `https://gutendex.com/books/?page=${page}`;
    const data = await this.httpGet(url);
    return data.results ?? [];
  }

  private normalizeGutendexResults(results: any[]): NormalizedBook[] {
    return results.map((book: any): NormalizedBook => ({
      title: book.title || 'Untitled',
      authors: Array.isArray(book.authors)
        ? book.authors.map((a: any) => a.name).filter(Boolean)
        : [],
      coverImageUrl: book.formats?.['image/jpeg'] ?? undefined,
      ebookUrl:
        book.formats?.['text/html'] ??
        book.formats?.['application/epub+zip'] ??
        undefined,
      source: 'Gutendex',
      isbn: undefined,
      publicationYear: undefined,
    }));
  }

  // ── HTTP helper (Node.js built-in, no external deps) ──────────

  private httpGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'LibrarySystem/1.0' } }, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            return;
          }
          let raw = '';
          res.on('data', (chunk: string) => (raw += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error('Invalid JSON response from external API'));
            }
          });
        })
        .on('error', reject);
    });
  }
}
