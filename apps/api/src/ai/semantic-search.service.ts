import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SearchIntent,
  BookCandidate,
  RankedBookResult,
  SearchContext,
} from './types/search.types';
import { getModelByTier } from './model-registry';

// Re-export for backward compatibility
export { BookCandidate, RankedBookResult, SearchContext } from './types/search.types';

type SemanticMode = 'keyword' | 'hybrid' | 'embedding';

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly mode: SemanticMode;
  private _lastSimilarityScores = new Map<string, number>();

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
    this._lastSimilarityScores = new Map();
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
    // Use explicitly-passed scores, or fall back to scores set by the last search
    const scores = similarityScores ?? this._lastSimilarityScores;

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
        scores.get(b.id),
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

  getLastSimilarityScores(): Map<string, number> {
    return this._lastSimilarityScores;
  }

  // ── Search strategies ──────────────────────────────────────────

  /**
   * Pure keyword search using Prisma text filters.
   * Fast, exact — production fallback for all other modes.
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
   * PostgreSQL Full-Text Search using tsvector/tsquery.
   * Handles stemming, stop words, and weighted fields (title > category/authors/tags > description).
   * Falls back to keyword search if FTS returns no results or errors.
   */
  private async ftsSearch(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    const queryText = [intent.keywords.join(' '), intent.category ?? '']
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!queryText) {
      return this.keywordSearch(intent, context);
    }

    try {
      // plainto_tsquery handles natural language safely — no syntax errors on arbitrary input
      const rows = await this.prisma.$queryRaw<Array<{ id: string; rank: number }>>`
        SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${queryText})) AS rank
        FROM books
        WHERE "isActive" = true
          AND search_vector IS NOT NULL
          AND search_vector @@ plainto_tsquery('english', ${queryText})
        ORDER BY rank DESC
        LIMIT 20
      `;

      if (rows.length === 0) {
        this.logger.debug('FTS returned no results, falling back to keyword search');
        return this.keywordSearch(intent, context);
      }

      const ids = rows.map((r) => r.id);
      const maxRank = Math.max(...rows.map((r) => Number(r.rank)), 0.001);

      const books = await this.prisma.book.findMany({
        where: { id: { in: ids } },
        select: this.bookCandidateSelect(),
      });

      // Store normalised FTS ranks (0–1) for rankBooks() semantic boost
      this._lastSimilarityScores = new Map(
        rows.map((r) => [r.id, Number(r.rank) / maxRank]),
      );

      // Return in FTS rank order (most relevant first)
      return ids.map((id) => books.find((b) => b.id === id)).filter(Boolean) as BookCandidate[];
    } catch (err) {
      this.logger.warn(`FTS search failed, falling back to keyword: ${String(err)}`);
      return this.keywordSearch(intent, context);
    }
  }

  /**
   * Hybrid search: FTS + keyword results merged.
   * Better recall than keyword alone — FTS contributes ranked relevance,
   * keyword catches exact matches FTS may miss due to language config.
   */
  private async hybridSearch(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    const [ftsResults, keywordResults] = await Promise.all([
      this.ftsSearch(intent, context),
      this.keywordSearch(intent, context),
    ]);

    // Deduplicate — prefer FTS order (ranked by relevance)
    const seen = new Set<string>();
    const merged: BookCandidate[] = [];

    for (const book of [...ftsResults, ...keywordResults]) {
      if (!seen.has(book.id)) {
        seen.add(book.id);
        merged.push(book);
      }
    }

    return merged.slice(0, 20);
  }

  /**
   * Embedding-style semantic search via LLM reranking.
   * Gets FTS candidates, then asks the tool-tier model to reorder them
   * by semantic relevance to the user's query.
   *
   * This uses the existing OPENROUTER_API_KEY — no extra provider needed.
   * Cost: ~200-400 tokens per search. Only active when AI_SEMANTIC_MODE=embedding.
   */
  private async embeddingSearch(
    intent: SearchIntent,
    context: SearchContext,
  ): Promise<BookCandidate[]> {
    const candidates = await this.ftsSearch(intent, context);
    if (candidates.length === 0) return candidates;

    const queryText = [intent.keywords.join(' '), intent.category ?? '']
      .filter(Boolean)
      .join(' ')
      .trim();

    const { reranked, scores } = await this.llmRerank(candidates, queryText);
    this._lastSimilarityScores = scores;
    return reranked;
  }

  /**
   * LLM reranking: sends FTS candidates to the tool-tier model and asks it
   * to reorder by semantic relevance. Returns original order on any failure.
   */
  private async llmRerank(
    candidates: BookCandidate[],
    query: string,
  ): Promise<{ reranked: BookCandidate[]; scores: Map<string, number> }> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || candidates.length === 0) {
      return { reranked: candidates, scores: new Map() };
    }

    const list = candidates
      .map(
        (b, i) =>
          `${i}. [${b.id}] "${b.title}" — ${b.authors.join(', ')} | ${b.category ?? 'Uncategorized'}`,
      )
      .join('\n');

    const prompt =
      `You are a library catalog relevance ranker. Given a user query and a list of books, ` +
      `return the IDs of the most relevant books in order from most to least relevant. ` +
      `Return ONLY a JSON array of book IDs, nothing else.\n\n` +
      `User query: "${query}"\n\nBooks:\n${list}`;

    try {
      const modelId = getModelByTier('tool').id;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:3000',
          'X-Title': 'LibrarySystem',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0,
        }),
      });

      if (!res.ok) {
        this.logger.debug(`LLM rerank request failed (${res.status}), returning FTS order`);
        return { reranked: candidates, scores: new Map() };
      }

      const data = await res.json() as { choices: [{ message: { content: string } }] };
      const content = data.choices?.[0]?.message?.content?.trim() ?? '';

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return { reranked: candidates, scores: new Map() };

      const orderedIds = JSON.parse(jsonMatch[0]) as string[];
      if (!Array.isArray(orderedIds)) return { reranked: candidates, scores: new Map() };

      const candidateMap = new Map(candidates.map((c) => [c.id, c]));
      const reranked: BookCandidate[] = [];
      const scores = new Map<string, number>();

      // LLM-ordered books first — descending score from 1.0 to 0.1
      for (let i = 0; i < orderedIds.length; i++) {
        const book = candidateMap.get(orderedIds[i]);
        if (book) {
          reranked.push(book);
          scores.set(book.id, Math.max(1 - (i / orderedIds.length) * 0.9, 0.1));
        }
      }

      // Append any candidates the LLM omitted (near-zero relevance)
      for (const c of candidates) {
        if (!scores.has(c.id)) {
          reranked.push(c);
          scores.set(c.id, 0.05);
        }
      }

      return { reranked, scores };
    } catch {
      this.logger.debug('LLM rerank failed, returning FTS order');
      return { reranked: candidates, scores: new Map() };
    }
  }

  // ── Embedding utilities ────────────────────────────────────────

  /**
   * Reserved for future vector embedding provider.
   * OpenRouter provides chat completions only, not an embeddings API.
   */
  async generateEmbedding(_text: string): Promise<number[] | null> {
    return null;
  }

  /**
   * Cosine similarity between two vectors.
   * Ready for use if a vector embedding provider is added in the future.
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

    // Semantic score boost (from FTS rank or LLM reranking)
    if (embeddingSimilarity !== undefined && embeddingSimilarity > 0) {
      const boost = Math.round(embeddingSimilarity * 15);
      score += boost;
      if (embeddingSimilarity >= 0.7) {
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
