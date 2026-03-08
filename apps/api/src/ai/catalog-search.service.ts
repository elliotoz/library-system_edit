import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatResponse } from './ai.service';
import { Role } from '@prisma/client';

export interface SearchIntent {
  keywords: string[];
  wantsAvailable: boolean;
  wantsReadingLists: boolean;
  category: string | null;
  audienceLevel: 'introductory' | 'advanced' | null;
  facultyHint: string | null;
}

interface RankedBookResult {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
  subjectTags: string[];
  availableCopies: number;
  totalCopies: number;
  readingListCount: number;
  facultyMatch: boolean;
  score: number;
  reasons: string[];
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

    const [books, readingLists] = await Promise.all([
      this.searchAndRank(intent, effectiveFaculty),
      intent.wantsReadingLists ? this.searchReadingLists(intent.keywords.join(' ')) : Promise.resolve([]),
    ]);

    const searchTerm = intent.keywords.join(' ');
    return this.formatResults(books, readingLists, intent, searchTerm, userRole, effectiveFaculty);
  }

  // ── Search + Rank ────────────────────────────────────────────

  private async searchAndRank(
    intent: SearchIntent,
    facultyName: string | null,
  ): Promise<RankedBookResult[]> {
    const searchTerm = intent.keywords.join(' ');
    const where: any = { isActive: true };

    // Build broad OR query across all text fields + individual keywords
    const orClauses: any[] = [];
    if (searchTerm) {
      orClauses.push(
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      );
      // Per-keyword matches for better recall
      for (const kw of intent.keywords) {
        orClauses.push(
          { title: { contains: kw, mode: 'insensitive' } },
          { subjectTags: { has: kw } },
          { authors: { has: kw } },
        );
      }
    }
    if (intent.category) {
      orClauses.push({ category: { contains: intent.category, mode: 'insensitive' } });
    }
    if (orClauses.length > 0) {
      where.OR = orClauses;
    }

    const books = await this.prisma.book.findMany({
      where,
      select: {
        id: true,
        title: true,
        authors: true,
        category: true,
        description: true,
        subjectTags: true,
        mainFaculty: { select: { name: true } },
        copies: { select: { status: true } },
        _count: { select: { readingListItems: true } },
      },
      take: 20, // fetch more, rank, then trim
      orderBy: { title: 'asc' },
    });

    const ranked: RankedBookResult[] = books.map((b) => {
      const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;
      const totalCopies = b.copies.length;
      const facultyMatch = facultyName ? (b.mainFaculty?.name === facultyName) : false;
      const readingListCount = b._count.readingListItems;

      const { score, reasons } = this.computeScore(b, intent, facultyName, availableCopies, readingListCount);

      return {
        id: b.id,
        title: b.title,
        authors: b.authors,
        category: b.category,
        subjectTags: b.subjectTags,
        availableCopies,
        totalCopies,
        readingListCount,
        facultyMatch,
        score,
        reasons,
      };
    });

    // Filter by availability if requested
    let filtered = intent.wantsAvailable ? ranked.filter((b) => b.availableCopies > 0) : ranked;

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    return filtered.slice(0, 8);
  }

  private computeScore(
    book: { title: string; authors: string[]; category: string | null; description: string | null; subjectTags: string[]; mainFaculty: { name: string } | null },
    intent: SearchIntent,
    facultyName: string | null,
    availableCopies: number,
    readingListCount: number,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const searchTerm = intent.keywords.join(' ').toLowerCase();
    const titleLower = book.title.toLowerCase();
    const descLower = (book.description || '').toLowerCase();

    // Title exact-phrase match (strongest signal)
    if (searchTerm && titleLower.includes(searchTerm)) {
      score += 10;
      reasons.push('Title match');
    }

    // Per-keyword title matches
    for (const kw of intent.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        score += 3;
      }
    }

    // Author match
    for (const kw of intent.keywords) {
      if (book.authors.some((a) => a.toLowerCase().includes(kw.toLowerCase()))) {
        score += 4;
        reasons.push('Author match');
        break;
      }
    }

    // Category match
    if (intent.category && book.category?.toLowerCase().includes(intent.category.toLowerCase())) {
      score += 5;
      reasons.push('Category match');
    }

    // Subject tag match
    const matchedTags = book.subjectTags.filter((tag) =>
      intent.keywords.some((kw) => tag.toLowerCase().includes(kw.toLowerCase())),
    );
    if (matchedTags.length > 0) {
      score += 3 * matchedTags.length;
      reasons.push('Subject tag match');
    }

    // Description match
    if (searchTerm && descLower.includes(searchTerm)) {
      score += 2;
      reasons.push('Description match');
    }

    // Availability boost
    if (availableCopies > 0) {
      score += 3;
      if (intent.wantsAvailable) {
        score += 2; // extra boost when user explicitly wants available
      }
      reasons.push('Available now');
    }

    // Faculty relevance boost
    if (facultyName && book.mainFaculty?.name === facultyName) {
      score += 4;
      reasons.push('Faculty match');
    }

    // Reading list popularity boost
    if (readingListCount > 0) {
      score += Math.min(readingListCount, 5); // cap at 5
      reasons.push(`In ${readingListCount} reading list${readingListCount !== 1 ? 's' : ''}`);
    }

    // Audience-level heuristic (keyword-based)
    if (intent.audienceLevel) {
      const combined = titleLower + ' ' + descLower;
      if (intent.audienceLevel === 'advanced') {
        if (this.has(combined, ['advanced', 'graduate', 'research', 'comprehensive', 'in-depth'])) {
          score += 3;
          reasons.push('Advanced level');
        }
      } else if (intent.audienceLevel === 'introductory') {
        if (this.has(combined, ['introduction', 'introductory', 'beginner', 'fundamentals', 'primer', 'essentials'])) {
          score += 3;
          reasons.push('Introductory level');
        }
      }
    }

    // Dedupe reasons
    const uniqueReasons = [...new Set(reasons)];

    return { score, reasons: uniqueReasons };
  }

  // ── Reading lists ────────────────────────────────────────────

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
        reply += `${i + 1}. **${b.title}**\n`;
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
}
