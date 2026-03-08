import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchIntent } from './catalog-search.service';

export interface BookCandidate {
  id: string;
  title: string;
  authors: string[];
  category: string | null;
  description: string | null;
  subjectTags: string[];
  mainFaculty: { name: string } | null;
  copies: { status: string }[];
  _count: { readingListItems: number };
}

export interface RankedBookResult {
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

export interface SearchContext {
  facultyName: string | null;
}

@Injectable()
export class SemanticSearchService {
  private readonly mode: string;

  constructor(private readonly prisma: PrismaService) {
    this.mode = process.env.AI_SEMANTIC_MODE || 'hybrid';
  }

  async searchBooks(intent: SearchIntent, context: SearchContext): Promise<BookCandidate[]> {
    const searchTerm = intent.keywords.join(' ');
    const where: any = { isActive: true };

    const orClauses: any[] = [];
    if (searchTerm) {
      orClauses.push(
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      );
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

    return this.prisma.book.findMany({
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
      take: 20,
      orderBy: { title: 'asc' },
    });
  }

  rankBooks(
    candidates: BookCandidate[],
    intent: SearchIntent,
    context: SearchContext,
  ): RankedBookResult[] {
    const ranked = candidates.map((b) => {
      const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;
      const totalCopies = b.copies.length;
      const facultyMatch = context.facultyName ? (b.mainFaculty?.name === context.facultyName) : false;
      const readingListCount = b._count.readingListItems;

      const { score, reasons } = this.computeScore(b, intent, context.facultyName, availableCopies, readingListCount);

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

    let filtered = intent.wantsAvailable ? ranked.filter((b) => b.availableCopies > 0) : ranked;
    filtered.sort((a, b) => b.score - a.score);

    return filtered.slice(0, 8);
  }

  getMode(): string {
    return this.mode;
  }

  // ── Scoring ──────────────────────────────────────────────────

  private computeScore(
    book: BookCandidate,
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

    if (searchTerm && titleLower.includes(searchTerm)) {
      score += 10;
      reasons.push('Title match');
    }

    for (const kw of intent.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        score += 3;
      }
    }

    for (const kw of intent.keywords) {
      if (book.authors.some((a) => a.toLowerCase().includes(kw.toLowerCase()))) {
        score += 4;
        reasons.push('Author match');
        break;
      }
    }

    if (intent.category && book.category?.toLowerCase().includes(intent.category.toLowerCase())) {
      score += 5;
      reasons.push('Category match');
    }

    const matchedTags = book.subjectTags.filter((tag) =>
      intent.keywords.some((kw) => tag.toLowerCase().includes(kw.toLowerCase())),
    );
    if (matchedTags.length > 0) {
      score += 3 * matchedTags.length;
      reasons.push('Subject tag match');
    }

    if (searchTerm && descLower.includes(searchTerm)) {
      score += 2;
      reasons.push('Description match');
    }

    if (availableCopies > 0) {
      score += 3;
      if (intent.wantsAvailable) {
        score += 2;
      }
      reasons.push('Available now');
    }

    if (facultyName && book.mainFaculty?.name === facultyName) {
      score += 4;
      reasons.push('Faculty match');
    }

    if (readingListCount > 0) {
      score += Math.min(readingListCount, 5);
      reasons.push(`In ${readingListCount} reading list${readingListCount !== 1 ? 's' : ''}`);
    }

    if (intent.audienceLevel) {
      const combined = titleLower + ' ' + descLower;
      if (intent.audienceLevel === 'advanced') {
        if (['advanced', 'graduate', 'research', 'comprehensive', 'in-depth'].some((w) => combined.includes(w))) {
          score += 3;
          reasons.push('Advanced level');
        }
      } else if (intent.audienceLevel === 'introductory') {
        if (['introduction', 'introductory', 'beginner', 'fundamentals', 'primer', 'essentials'].some((w) => combined.includes(w))) {
          score += 3;
          reasons.push('Introductory level');
        }
      }
    }

    return { score, reasons: [...new Set(reasons)] };
  }
}
