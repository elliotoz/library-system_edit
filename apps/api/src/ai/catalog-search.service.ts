import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatResponse } from './ai.service';
import { Role } from '@prisma/client';

interface SearchIntent {
  keywords: string[];
  wantsAvailable: boolean;
  wantsReadingLists: boolean;
  category: string | null;
}

interface BookResult {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
  availableCopies: number;
  totalCopies: number;
}

interface ReadingListResult {
  id: string;
  title: string;
  ownerName: string;
  itemCount: number;
}

@Injectable()
export class CatalogSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect whether a message is a natural-language search query.
   */
  isSearchQuery(message: string): boolean {
    const lower = message.toLowerCase();
    // Must contain topic-like keywords alongside search intent signals
    const intentSignals = [
      'find', 'search', 'look for', 'looking for',
      'books about', 'books on', 'book about', 'book on',
      'any book', 'show me', 'do you have',
      'available', 'what books', 'which books',
      'related to', 'topic', 'subject',
      'i need', 'i want', 'can you find',
    ];
    return intentSignals.some((s) => lower.includes(s));
  }

  /**
   * Parse a natural-language message into search intent.
   */
  parseIntent(message: string): SearchIntent {
    const lower = message.toLowerCase();

    const wantsAvailable = this.has(lower, ['available', 'in stock', 'can borrow', 'not borrowed']);
    const wantsReadingLists = this.has(lower, ['reading list', 'course list', 'syllabus', 'curated']);

    // Extract category hint from known patterns
    const category = this.extractCategory(lower);

    // Extract topic keywords by removing noise words
    const keywords = this.extractKeywords(lower);

    return { keywords, wantsAvailable, wantsReadingLists, category };
  }

  /**
   * Execute a catalog search and return a formatted ChatResponse.
   */
  async search(
    message: string,
    userRole: Role,
    facultyName: string | null,
  ): Promise<ChatResponse> {
    const intent = this.parseIntent(message);

    if (intent.keywords.length === 0 && !intent.category) {
      return {
        reply:
          '🔍 I\'d love to search for books! Could you be more specific?\n\n' +
          'Try something like:\n' +
          '- "Find books about machine learning"\n' +
          '- "Do you have any psychology books available?"\n' +
          '- "Books on software engineering"\n' +
          '- "Show me reading lists about data science"',
        sources: ['/dashboard/catalog'],
      };
    }

    const searchTerm = intent.keywords.join(' ');

    // Run book search and reading list search in parallel
    const [books, readingLists] = await Promise.all([
      this.searchBooks(searchTerm, intent),
      intent.wantsReadingLists ? this.searchReadingLists(searchTerm) : Promise.resolve([]),
    ]);

    return this.formatResults(books, readingLists, intent, searchTerm, userRole, facultyName);
  }

  // ── Private helpers ────────────────────────────────────────────

  private async searchBooks(searchTerm: string, intent: SearchIntent): Promise<BookResult[]> {
    const where: any = { isActive: true };

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { authors: { has: searchTerm } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
        { subjectTags: { has: searchTerm } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (intent.category) {
      where.category = { contains: intent.category, mode: 'insensitive' };
    }

    const books = await this.prisma.book.findMany({
      where,
      select: {
        id: true,
        title: true,
        authors: true,
        category: true,
        copies: {
          select: { status: true },
        },
      },
      take: 8,
      orderBy: { title: 'asc' },
    });

    let results: BookResult[] = books.map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authors,
      category: b.category,
      totalCopies: b.copies.length,
      availableCopies: b.copies.filter((c) => c.status === 'AVAILABLE').length,
    }));

    if (intent.wantsAvailable) {
      results = results.filter((b) => b.availableCopies > 0);
    }

    return results;
  }

  private async searchReadingLists(searchTerm: string): Promise<ReadingListResult[]> {
    const lists = await this.prisma.readingList.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: { not: 'PRIVATE' },
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { courseCode: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        owner: { select: { name: true } },
        _count: { select: { items: true } },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return lists.map((l) => ({
      id: l.id,
      title: l.title,
      ownerName: l.owner.name,
      itemCount: l._count.items,
    }));
  }

  private formatResults(
    books: BookResult[],
    readingLists: ReadingListResult[],
    intent: SearchIntent,
    searchTerm: string,
    userRole: Role,
    facultyName: string | null,
  ): ChatResponse {
    const sources: string[] = [];
    let reply = '';

    // Books section
    if (books.length > 0) {
      reply += `🔍 **Found ${books.length} book${books.length !== 1 ? 's' : ''}** matching "${searchTerm}"`;
      if (intent.wantsAvailable) {
        reply += ' (available only)';
      }
      reply += ':\n\n';

      books.forEach((b, i) => {
        const avail = b.availableCopies > 0
          ? `✅ ${b.availableCopies} available`
          : '❌ Not available';
        reply += `${i + 1}. **${b.title}**\n`;
        reply += `   ${b.authors.join(', ')}`;
        if (b.category) reply += ` · ${b.category}`;
        reply += ` · ${avail}\n`;
      });

      // Build catalog search link
      const searchParam = encodeURIComponent(searchTerm);
      sources.push(`/dashboard/catalog?search=${searchParam}`);

      reply += `\n📖 [View all results in Catalog →](/dashboard/catalog?search=${searchParam})\n`;
    } else {
      reply += `🔍 No books found matching "${searchTerm}"`;
      if (intent.wantsAvailable) {
        reply += ' with available copies';
      }
      reply += '.\n\n';
      reply += 'Try different keywords or browse the full **Catalog**.\n';
      sources.push('/dashboard/catalog');
    }

    // Reading lists section
    if (readingLists.length > 0) {
      reply += '\n📋 **Related Reading Lists:**\n';
      readingLists.forEach((rl) => {
        reply += `- **${rl.title}** by ${rl.ownerName} (${rl.itemCount} book${rl.itemCount !== 1 ? 's' : ''})\n`;
      });
      sources.push('/dashboard/reading-lists');
    }

    // Role-specific hints
    if (userRole === Role.INSTRUCTOR && books.length > 0) {
      reply += '\n💡 **Tip:** You can add any of these books to your reading lists from the catalog page.';
    }
    if (facultyName && books.length === 0) {
      reply += `\n💡 You can also browse books specific to your faculty (**${facultyName}**) in the catalog.`;
    }

    return { reply, sources };
  }

  private extractCategory(text: string): string | null {
    const categoryPatterns: Record<string, string[]> = {
      'Computer Science': ['computer science', 'programming', 'software', 'algorithm', 'coding'],
      'Psychology': ['psychology', 'behavioral', 'cognitive', 'mental health'],
      'Mathematics': ['math', 'mathematics', 'calculus', 'algebra', 'statistics'],
      'Engineering': ['engineering', 'mechanical', 'electrical', 'civil engineering'],
      'Business': ['business', 'management', 'marketing', 'finance', 'economics'],
      'Literature': ['literature', 'novel', 'fiction', 'poetry'],
      'History': ['history', 'historical'],
      'Science': ['physics', 'chemistry', 'biology', 'science'],
      'Medicine': ['medicine', 'medical', 'anatomy', 'pharmacology'],
      'Law': ['law', 'legal', 'jurisprudence'],
    };

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (patterns.some((p) => text.includes(p))) {
        return category;
      }
    }
    return null;
  }

  private extractKeywords(text: string): string[] {
    const noise = new Set([
      'find', 'search', 'look', 'for', 'show', 'me', 'do', 'you', 'have', 'any',
      'books', 'book', 'about', 'on', 'the', 'a', 'an', 'in', 'of', 'and', 'or',
      'can', 'could', 'please', 'i', 'need', 'want', 'to', 'is', 'are', 'there',
      'looking', 'related', 'topic', 'subject', 'available', 'that', 'with',
      'some', 'which', 'what', 'reading', 'list', 'lists', 'curated',
      'recommend', 'suggest', 'give', 'tell', 'get', 'help',
    ]);

    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.has(w));
  }

  private has(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
