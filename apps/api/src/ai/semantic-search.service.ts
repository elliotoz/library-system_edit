import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchIntent,
  BookCandidate,
  RankedBookResult,
  SearchContext,
} from './types/search.types';

// Re-export for backward compatibility
export { BookCandidate, RankedBookResult, SearchContext } from './types/search.types';

type SemanticMode = 'keyword' | 'hybrid' | 'embedding';

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly mode: SemanticMode;

  constructor(private readonly prisma: PrismaService) {
    const raw = process.env.AI_SEMANTIC_MODE || 'hybrid';
    this.mode = this.parseMode(raw);
    this.logger.log(`Semantic search mode: ${this.mode}`);
  }

  // ── Public API ─────────────────────────────────────────────────

  async searchBooks(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    switch (this.mode) {
      case 'embedding':
        return this.embeddingSearch(intent, context);
      case 'hybrid':
        return this.hybridSearch(intent, context);
      case 'keyword':
      default:
        return this.keywordSearch(intent, context);
    }
  }

  rankBooks(
    candidates: BookCandidate[],
    intent: SearchIntent,
    context: SearchContext,
    similarityScores?: Map<string, number>,
  ): RankedBookResult[] {
    const ranked = candidates.map((b) => {
      const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;
      const totalCopies = b.copies.length;
      const facultyMatch = context.facultyName
        ? b.mainFaculty?.name === context.facultyName
        : false;
      const readingListCount = b._count.readingListItems;

      const { score, reasons } = this.computeScore(
        b,
        intent,
        context.facultyName,
        availableCopies,
        readingListCount,
        similarityScores?.get(b.id),
      );

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

    let filtered = intent.wantsAvailable
      ? ranked.filter((b) => b.availableCopies > 0)
      : ranked;
    filtered.sort((a, b) => b.score - a.score);

    return filtered.slice(0, 8);
  }

  getMode(): SemanticMode {
    return this.mode;
  }

  // ── Search strategies ──────────────────────────────────────────

  /**
   * Pure keyword search using Prisma text filters.
   * This is the current production path.
   */
  private async keywordSearch(
    intent: SearchIntent,
    _context: SearchContext,
  ): Promise<BookCandidate[]> {
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
      orClauses.push({
        category: { contains: intent.category, mode: 'insensitive' },
      });
    }
    if (orClauses.length > 0) {
      where.OR = orClauses;
    }

    return this.prisma.book.findMany({
      where,
      select: this.bookCandidateSelect(),
      take: 20,
      orderBy: { title: 'asc' },
    });
  }

  /**
   * Embedding-based search.
   * Placeholder: falls back to keyword search until embedding
   * infrastructure (vector column + generation pipeline) is in place.
   *
   * Future implementation will:
   * 1. Call generateEmbedding() on the query
   * 2. Query a pgvector index for nearest neighbors
   * 3. Return candidates ordered by cosine similarity
   */
  private async embeddingSearch(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    // TODO: replace with vector query once Book.embedding column exists
    this.logger.debug(
      'Embedding search not yet available, falling back to keyword search',
    );
    return this.keywordSearch(intent, context);
  }

  /**
   * Hybrid search: keyword results merged with embedding results.
   * Currently behaves identically to keyword-only search.
   *
   * Future implementation will:
   * 1. Run keyword and embedding searches in parallel
   * 2. Merge and deduplicate candidates
   * 3. Pass similarity scores into rankBooks() for blended scoring
   */
  private async hybridSearch(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    // TODO: merge keyword + embedding results once vectors are available
    return this.keywordSearch(intent, context);
  }

  // ── Embedding utilities (stubs) ────────────────────────────────

  /**
   * Generate an embedding vector for the given text.
   * Returns null until an embedding provider is configured.
   *
   * Future: call Ollama /api/embeddings or an external API.
   */
  async generateEmbedding(_text: string): Promise<number[] | null> {
    // TODO: integrate with Ollama embeddings or external API
    return null;
  }

  /**
   * Cosine similarity between two vectors.
   * Ready for use once embeddings are generated.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ── Shared helpers ─────────────────────────────────────────────

  private bookCandidateSelect() {
    return {
      id: true,
      title: true,
      authors: true,
      category: true,
      description: true,
      subjectTags: true,
      mainFaculty: { select: { name: true } },
      copies: { select: { status: true } },
      _count: { select: { readingListItems: true } },
    } as const;
  }

  // ── Scoring ────────────────────────────────────────────────────

  private computeScore(
    book: BookCandidate,
    intent: SearchIntent,
    facultyName: string | null,
    availableCopies: number,
    readingListCount: number,
    embeddingSimilarity?: number,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const searchTerm = intent.keywords.join(' ').toLowerCase();
    const titleLower = book.title.toLowerCase();
    const descLower = (book.description || '').toLowerCase();

    // Embedding similarity boost (when available)
    if (embeddingSimilarity !== undefined && embeddingSimilarity > 0) {
      const boost = Math.round(embeddingSimilarity * 15);
      score += boost;
      if (embeddingSimilarity >= 0.8) {
        reasons.push('Semantic match');
      }
    }

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
      if (
        book.authors.some((a) =>
          a.toLowerCase().includes(kw.toLowerCase()),
        )
      ) {
        score += 4;
        reasons.push('Author match');
        break;
      }
    }

    if (
      intent.category &&
      book.category?.toLowerCase().includes(intent.category.toLowerCase())
    ) {
      score += 5;
      reasons.push('Category match');
    }

    const matchedTags = book.subjectTags.filter((tag) =>
      intent.keywords.some((kw) =>
        tag.toLowerCase().includes(kw.toLowerCase()),
      ),
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
      reasons.push(
        `In ${readingListCount} reading list${readingListCount !== 1 ? 's' : ''}`,
      );
    }

    if (intent.audienceLevel) {
      const combined = titleLower + ' ' + descLower;
      if (intent.audienceLevel === 'advanced') {
        if (
          ['advanced', 'graduate', 'research', 'comprehensive', 'in-depth'].some(
            (w) => combined.includes(w),
          )
        ) {
          score += 3;
          reasons.push('Advanced level');
        }
      } else if (intent.audienceLevel === 'introductory') {
        if (
          [
            'introduction',
            'introductory',
            'beginner',
            'fundamentals',
            'primer',
            'essentials',
          ].some((w) => combined.includes(w))
        ) {
          score += 3;
          reasons.push('Introductory level');
        }
      }
    }

    return { score, reasons: [...new Set(reasons)] };
  }

  private parseMode(raw: string): SemanticMode {
    const valid: SemanticMode[] = ['keyword', 'hybrid', 'embedding'];
    const normalized = raw.toLowerCase().trim() as SemanticMode;
    return valid.includes(normalized) ? normalized : 'hybrid';
  }
}
