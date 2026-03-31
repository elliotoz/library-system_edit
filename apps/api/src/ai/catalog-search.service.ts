import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatResponse } from './ai.service';
import { Role } from '@prisma/client';
import { SemanticSearchService, RankedBookResult } from './semantic-search.service';
import { SearchIntent, SearchContext, ReadingListResult } from './types/search.types';

// Re-export for backward compatibility
export { SearchIntent } from './types/search.types';

@Injectable()
export class CatalogSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semanticSearch: SemanticSearchService,
  ) {}

  isSearchQuery(message: string): boolean {
    const lower = message.toLowerCase();
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

  parseIntent(message: string): SearchIntent {
    const lower = message.toLowerCase();

    const wantsAvailable = this.has(lower, ['available', 'in stock', 'can borrow', 'not borrowed', 'available now']);
    const wantsReadingLists = this.has(lower, ['reading list', 'course list', 'syllabus', 'curated']);
    const category = this.extractCategory(lower);
    const keywords = this.extractKeywords(lower);
    const audienceLevel = this.extractAudienceLevel(lower);
    const facultyHint = this.extractFacultyHint(lower);

    return { keywords, wantsAvailable, wantsReadingLists, category, audienceLevel, facultyHint };
  }

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
        modelUsed: 'search',
        sources: ['/dashboard/catalog'],
      };
    }

    const effectiveFaculty = intent.facultyHint || facultyName;
    const context = { facultyName: effectiveFaculty };

    const [candidates, readingLists] = await Promise.all([
      this.semanticSearch.searchBooks(intent, context),
      intent.wantsReadingLists ? this.searchReadingLists(intent.keywords.join(' ')) : Promise.resolve([]),
    ]);

    const books = this.semanticSearch.rankBooks(candidates, intent, context);
    const searchTerm = intent.keywords.join(' ');

    return this.formatResults(books, readingLists, intent, searchTerm, userRole, effectiveFaculty);
  }

  // ── Reading lists ────────────────────────────────────────────

  async searchReadingLists(searchTerm: string): Promise<ReadingListResult[]> {
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

  // ── Format ───────────────────────────────────────────────────

  private formatResults(
    books: RankedBookResult[],
    readingLists: ReadingListResult[],
    intent: SearchIntent,
    searchTerm: string,
    userRole: Role,
    facultyName: string | null,
  ): ChatResponse {
    const sources: string[] = [];
    let reply = '';

    if (books.length > 0) {
      reply += `🔍 **Found ${books.length} book${books.length !== 1 ? 's' : ''}** matching "${searchTerm}"`;
      if (intent.wantsAvailable) {
        reply += ' (available only)';
      }
      if (intent.audienceLevel) {
        reply += ` (${intent.audienceLevel} level)`;
      }
      reply += ':\n\n';

      books.forEach((b, i) => {
        const avail = b.availableCopies > 0
          ? `✅ ${b.availableCopies} available`
          : '❌ Not available';
        reply += `${i + 1}. **[${b.title}](/dashboard/catalog/${b.id})**\n`;
        reply += `   ${b.authors.join(', ')}`;
        if (b.category) reply += ` · ${b.category}`;
        reply += ` · ${avail}\n`;
        if (b.reasons.length > 0) {
          reply += `   _${b.reasons.join(' · ')}_\n`;
        }
      });

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

    if (readingLists.length > 0) {
      reply += '\n📋 **Related Reading Lists:**\n';
      readingLists.forEach((rl) => {
        reply += `- **${rl.title}** by ${rl.ownerName} (${rl.itemCount} book${rl.itemCount !== 1 ? 's' : ''})\n`;
      });
      sources.push('/dashboard/reading-lists');
    }

    if (userRole === Role.INSTRUCTOR && books.length > 0) {
      reply += '\n💡 **Tip:** You can add any of these books to your reading lists from the catalog page.';
    }
    if (facultyName && books.length === 0) {
      reply += `\n💡 You can also browse books specific to your faculty (**${facultyName}**) in the catalog.`;
    }

    return { reply, modelUsed: 'search', sources };
  }

  // ── Intent extraction helpers ────────────────────────────────

  private extractAudienceLevel(text: string): 'introductory' | 'advanced' | null {
    if (this.has(text, ['advanced', 'graduate', 'research-level', 'in-depth', 'comprehensive'])) {
      return 'advanced';
    }
    if (this.has(text, ['introductory', 'introduction', 'beginner', 'basics', 'fundamentals', 'primer', 'getting started'])) {
      return 'introductory';
    }
    return null;
  }

  private extractFacultyHint(text: string): string | null {
    const facultyPatterns: Record<string, string[]> = {
      'Computer Science': ['computer science faculty', 'cs department', 'computing faculty'],
      'Engineering': ['engineering faculty', 'engineering department'],
      'Business': ['business faculty', 'business school', 'management faculty'],
      'Medicine': ['medical faculty', 'medicine faculty', 'medical school'],
      'Law': ['law faculty', 'law school'],
      'Arts': ['arts faculty', 'humanities faculty'],
      'Science': ['science faculty', 'natural sciences'],
    };
    for (const [faculty, patterns] of Object.entries(facultyPatterns)) {
      if (patterns.some((p) => text.includes(p))) {
        return faculty;
      }
    }
    return null;
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
      'recommend', 'suggest', 'give', 'tell', 'get', 'help', 'now',
      'advanced', 'introductory', 'introduction', 'beginner', 'level',
      'teaching', 'course', 'faculty',
    ]);

    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.has(w));
  }

  private has(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }

  // ── Agent-oriented search (structured JSON, no markdown) ──────

  /**
   * Search the catalog for the agent tool layer.
   * Returns structured results the LLM can present directly.
   * Runs a second pass with a normalized short title if the first pass
   * returns nothing (handles subtitle + punctuation stripping).
   */
  async searchForAgent(
    query: string,
    pageSize = 5,
  ): Promise<{
    matchedQuery: string;
    total: number;
    fallbackUsed: boolean;
    fallbackQuery?: string;
    results: {
      title: string;
      authors: string[];
      category: string | null;
      subjects: string[];
      available: boolean;
      copies: string;
      reasons: string[];
      catalogLink: string;
    }[];
  }> {
    const limit = Math.min(pageSize, 10);
    const context: SearchContext = { facultyName: null };

    // First pass: full query through intent parser
    const intent = this.parseIntent(query);
    const candidates = await this.semanticSearch.searchBooks(intent, context);
    let books = this.semanticSearch.rankBooks(candidates, intent, context).slice(0, limit);

    // Second pass: strip subtitle after ':' and punctuation if first pass empty
    let fallbackUsed = false;
    let fallbackQuery: string | undefined;
    if (books.length === 0) {
      const normalized = this.normalizeQueryForSearch(query);
      if (normalized && normalized !== query.trim().toLowerCase()) {
        const fallbackIntent = this.parseIntent(normalized);
        const fallbackCandidates = await this.semanticSearch.searchBooks(fallbackIntent, context);
        const fallbackBooks = this.semanticSearch
          .rankBooks(fallbackCandidates, fallbackIntent, context)
          .slice(0, limit);
        if (fallbackBooks.length > 0) {
          books = fallbackBooks;
          fallbackUsed = true;
          fallbackQuery = normalized;
        }
      }
    }

    return {
      matchedQuery: query,
      total: books.length,
      fallbackUsed,
      ...(fallbackQuery ? { fallbackQuery } : {}),
      results: books.map((b) => ({
        // id is intentionally omitted — catalogLink is the only navigation field
        title: b.title,
        authors: b.authors,
        category: b.category ?? null,
        subjects: b.subjectTags,
        available: b.availableCopies > 0,
        copies: `${b.availableCopies}/${b.totalCopies}`,
        reasons: b.reasons,
        catalogLink: `/dashboard/catalog/${b.id}`,
      })),
    };
  }

  /**
   * Formats a searchForAgent result as preformatted tool output lines.
   * Each line embeds the exact catalogLink so the model can reproduce it
   * verbatim without reconstructing or guessing the URL.
   *
   * Example line:
   *   - [Clean Code](/dashboard/catalog/abc123) — Robert C. Martin · Computer Science · ✅ 1/2 copies
   */
  formatSearchResults(result: Awaited<ReturnType<typeof this.searchForAgent>>): string {
    const { total, matchedQuery, fallbackUsed, fallbackQuery, results } = result;
    const header = fallbackUsed
      ? `Found ${total} book${total !== 1 ? 's' : ''} for "${matchedQuery}" (searched as: "${fallbackQuery}"):`
      : `Found ${total} book${total !== 1 ? 's' : ''} for "${matchedQuery}":`;

    const lines = results.map((b) => {
      const authors = b.authors.slice(0, 2).join(', ');
      const cat = b.category ? ` · ${b.category}` : '';
      const avail = b.available ? `✅ ${b.copies} copies` : `❌ All copies borrowed`;
      return `- [${b.title}](${b.catalogLink}) — ${authors}${cat} · ${avail}`;
    });

    return `${header}\n\n${lines.join('\n')}`;
  }

  /**
   * Normalise a full book title for a fallback search pass.
   * Strips subtitle text after ':', punctuation, and extra whitespace.
   * "Clean Code: A Handbook of Agile..." → "clean code"
   */
  private normalizeQueryForSearch(query: string): string {
    return query
      .split(':')[0]
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
