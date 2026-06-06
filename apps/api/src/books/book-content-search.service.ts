import { Injectable } from '@nestjs/common';
import { IndexStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;
const DEFAULT_CONTEXT_WINDOW = 1;
const MAX_CONTEXT_WINDOW = 3;
const DEFAULT_STRUCTURE_EVIDENCE_LIMIT = 8;
const MAX_STRUCTURE_EVIDENCE_LIMIT = 12;
const EARLY_STRUCTURE_CHUNK_LIMIT = 40;
const KEYWORD_STRUCTURE_CHUNK_LIMIT = 20;

export interface BookChunkSearchResult {
  bookId: string;
  title: string;
  authors: string[];
  chunkId: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  rank: number;
}

export interface BookChunkContextResult {
  book: {
    id: string;
    title: string;
    authors: string[];
  } | null;
  targetChunkIndex: number;
  chunks: Array<{
    chunkId: string;
    bookId: string;
    chunkIndex: number;
    pageNumber: number | null;
    content: string;
  }>;
}

export interface BookOutlineResult {
  book: {
    id: string;
    title: string;
    authors: string[];
    pdfPageCount: number | null;
    pdfIndexStatus: IndexStatus;
    totalChunkCount: number;
  } | null;
  chunks: Array<{
    chunkId: string;
    bookId: string;
    chunkIndex: number;
    pageNumber: number | null;
    content: string;
  }>;
}

export interface BookStructureResult {
  book: {
    id: string;
    title: string;
    authors: string[];
    pdfPageCount: number | null;
    pdfIndexStatus: IndexStatus;
    totalChunks: number;
  } | null;
  confidence: 'complete' | 'partial' | 'unknown';
  message: string;
  evidence: Array<{
    chunkId: string;
    chunkIndex: number;
    pageNumber: number | null;
    reason: string;
    excerpt: string;
  }>;
}

@Injectable()
export class BookContentSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchBookChunks(input: {
    query: string;
    bookId?: string;
    limit?: number;
  }): Promise<BookChunkSearchResult[]> {
    const query = input.query.trim();
    if (query.length < 2) return [];

    const safeLimit = clampLimit(input.limit);
    const conditions = [
      `b."isActive" = true`,
      `to_tsvector('simple', bc.content) @@ websearch_to_tsquery('simple', $1)`,
    ];
    const params: unknown[] = [query];
    let paramIndex = 2;

    if (input.bookId) {
      conditions.push(`bc."bookId" = $${paramIndex++}`);
      params.push(input.bookId);
    }

    const sql = `
      SELECT
        bc.id AS "chunkId",
        bc."bookId",
        bc."chunkIndex",
        bc."pageNumber",
        bc.content,
        b.title,
        b.authors,
        ts_rank(
          to_tsvector('simple', bc.content),
          websearch_to_tsquery('simple', $1)
        ) AS rank
      FROM book_chunks bc
      JOIN books b ON b.id = bc."bookId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, bc."chunkIndex" ASC
      LIMIT ${safeLimit}
    `;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        chunkId: string;
        bookId: string;
        chunkIndex: number;
        pageNumber: number | null;
        content: string;
        title: string;
        authors: string[];
        rank: number;
      }>
    >(sql, ...params);

    return rows.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      authors: row.authors,
      chunkId: row.chunkId,
      chunkIndex: row.chunkIndex,
      pageNumber: row.pageNumber,
      content: row.content,
      rank: Number(row.rank),
    }));
  }

  async getBookChunkContext(input: {
    bookId: string;
    chunkIndex: number;
    before?: number;
    after?: number;
  }): Promise<BookChunkContextResult> {
    const before = clampContextWindow(input.before);
    const after = clampContextWindow(input.after);

    const target = await this.prisma.bookChunk.findFirst({
      where: {
        bookId: input.bookId,
        chunkIndex: input.chunkIndex,
        book: { isActive: true },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
          },
        },
      },
    });

    if (!target) {
      return {
        book: null,
        targetChunkIndex: input.chunkIndex,
        chunks: [],
      };
    }

    const chunks = await this.prisma.bookChunk.findMany({
      where: {
        bookId: input.bookId,
        book: { isActive: true },
        chunkIndex: {
          gte: input.chunkIndex - before,
          lte: input.chunkIndex + after,
        },
      },
      orderBy: { chunkIndex: 'asc' },
      select: chunkSelect,
    });

    return {
      book: target.book,
      targetChunkIndex: input.chunkIndex,
      chunks: chunks.map(toChunkResult),
    };
  }

  async getBookOutline(input: {
    bookId: string;
    limit?: number;
  }): Promise<BookOutlineResult> {
    const safeLimit = clampLimit(input.limit);

    const book = await this.prisma.book.findFirst({
      where: { id: input.bookId, isActive: true },
      select: {
        id: true,
        title: true,
        authors: true,
        pdfPageCount: true,
        pdfIndexStatus: true,
        _count: { select: { chunks: true } },
      },
    });

    if (!book) {
      return { book: null, chunks: [] };
    }

    const chunks = await this.prisma.bookChunk.findMany({
      where: {
        bookId: input.bookId,
        book: { isActive: true },
      },
      orderBy: { chunkIndex: 'asc' },
      take: safeLimit,
      select: chunkSelect,
    });

    return {
      book: {
        id: book.id,
        title: book.title,
        authors: book.authors,
        pdfPageCount: book.pdfPageCount,
        pdfIndexStatus: book.pdfIndexStatus,
        totalChunkCount: book._count.chunks,
      },
      chunks: chunks.map(toChunkResult),
    };
  }

  async findBookStructure(input: {
    bookId: string;
    limit?: number;
  }): Promise<BookStructureResult> {
    const safeLimit = clampStructureLimit(input.limit);
    const book = await this.prisma.book.findFirst({
      where: { id: input.bookId, isActive: true },
      select: {
        id: true,
        title: true,
        authors: true,
        pdfPageCount: true,
        pdfIndexStatus: true,
        _count: { select: { chunks: true } },
      },
    });

    if (!book) {
      return {
        book: null,
        confidence: 'unknown',
        message: 'No active indexed catalog book was found for this structure search.',
        evidence: [],
      };
    }

    const [earlyChunks, keywordChunks] = await Promise.all([
      this.prisma.bookChunk.findMany({
        where: {
          bookId: input.bookId,
          book: { isActive: true },
        },
        orderBy: { chunkIndex: 'asc' },
        take: EARLY_STRUCTURE_CHUNK_LIMIT,
        select: chunkSelect,
      }),
      this.prisma.bookChunk.findMany({
        where: {
          bookId: input.bookId,
          book: { isActive: true },
          OR: STRUCTURE_KEYWORDS.map((keyword) => ({
            content: { contains: keyword, mode: 'insensitive' as const },
          })),
        },
        orderBy: { chunkIndex: 'asc' },
        take: KEYWORD_STRUCTURE_CHUNK_LIMIT,
        select: chunkSelect,
      }),
    ]);

    const evidenceCandidates = new Map<string, {
      chunkId: string;
      chunkIndex: number;
      pageNumber: number | null;
      reason: string;
      excerpt: string;
      content: string;
    }>();

    for (const chunk of earlyChunks) {
      const reasons = getStructureReasons(chunk.content);
      if (reasons.length === 0) continue;
      evidenceCandidates.set(chunk.id, {
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        reason: `early chunk; ${reasons.join('; ')}`,
        excerpt: buildStructureExcerpt(chunk.content),
        content: chunk.content,
      });
    }

    for (const chunk of keywordChunks) {
      const reasons = getStructureReasons(chunk.content);
      if (reasons.length === 0) continue;
      const existing = evidenceCandidates.get(chunk.id);
      if (existing) {
        existing.reason = mergeReasons(existing.reason, `keyword match; ${reasons.join('; ')}`);
        continue;
      }
      evidenceCandidates.set(chunk.id, {
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        reason: `keyword match; ${reasons.join('; ')}`,
        excerpt: buildStructureExcerpt(chunk.content),
        content: chunk.content,
      });
    }

    const sortedCandidates = Array.from(evidenceCandidates.values())
      .sort((a, b) => scoreStructureCandidate(b.content, b.chunkIndex) - scoreStructureCandidate(a.content, a.chunkIndex) || a.chunkIndex - b.chunkIndex);
    const confidence = determineStructureConfidence(sortedCandidates.map((candidate) => candidate.content));
    const evidence = sortedCandidates.slice(0, safeLimit).map(({ content: _content, ...candidate }) => candidate);

    return {
      book: {
        id: book.id,
        title: book.title,
        authors: book.authors,
        pdfPageCount: book.pdfPageCount,
        pdfIndexStatus: book.pdfIndexStatus,
        totalChunks: book._count.chunks,
      },
      confidence,
      message: buildStructureMessage(confidence),
      evidence,
    };
  }
}

const chunkSelect = {
  id: true,
  bookId: true,
  chunkIndex: true,
  pageNumber: true,
  content: true,
} as const;

function toChunkResult(chunk: {
  id: string;
  bookId: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
}) {
  return {
    chunkId: chunk.id,
    bookId: chunk.bookId,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    content: chunk.content,
  };
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return DEFAULT_SEARCH_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_SEARCH_LIMIT);
}

function clampContextWindow(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value < 0) {
    return DEFAULT_CONTEXT_WINDOW;
  }
  return Math.min(Math.floor(value), MAX_CONTEXT_WINDOW);
}

function clampStructureLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return DEFAULT_STRUCTURE_EVIDENCE_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_STRUCTURE_EVIDENCE_LIMIT);
}

const STRUCTURE_KEYWORDS = [
  'contents',
  'brief contents',
  'table of contents',
  'chapter',
  'part',
  'unit',
  'the layers',
  'overview',
  'preface',
];

function getStructureReasons(content: string): string[] {
  const lower = content.toLowerCase();
  const reasons: string[] = [];

  if (/table\s+of\s+contents|brief\s+contents|\bcontents\b/.test(lower)) {
    reasons.push('contents marker');
  }
  if (/\bchapter\s+\d{1,3}\b/i.test(content) || /(?:^|\n)\s*\d{1,3}\s+[A-Z][^\n]{2,120}/.test(content)) {
    reasons.push('chapter-like pattern');
  }
  if (/\bpart\s+\d{1,3}\b|\bunit\s+\d{1,3}\b/i.test(content)) {
    reasons.push('part/unit pattern');
  }
  if (/\b(the layers|overview|preface)\b/i.test(content)) {
    reasons.push('structure keyword');
  }

  return reasons;
}

function buildStructureExcerpt(content: string, maxChars = 1800): string {
  const normalized = content.replace(/\r/g, '').trim();
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const firstStructureLine = lines.findIndex((line) => getStructureReasons(line).length > 0);
  const start = firstStructureLine >= 0 ? Math.max(0, firstStructureLine - 2) : 0;
  const excerpt = lines.slice(start, start + 40).join('\n');

  if (excerpt.length <= maxChars) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxChars).trimEnd()}...`;
}

function scoreStructureCandidate(content: string, chunkIndex: number): number {
  const reasons = getStructureReasons(content);
  const lower = content.toLowerCase();
  let score = reasons.length * 10;
  if (/table\s+of\s+contents|brief\s+contents|\bcontents\b/.test(lower)) score += 20;
  score += Math.min(countDistinctChapterNumbers(content), 10);
  if (chunkIndex < EARLY_STRUCTURE_CHUNK_LIMIT) score += Math.max(0, 10 - Math.floor(chunkIndex / 4));
  return score;
}

function determineStructureConfidence(contents: string[]): 'complete' | 'partial' | 'unknown' {
  if (contents.length === 0) return 'unknown';

  const combined = contents.join('\n');
  const hasContentsMarker = /table\s+of\s+contents|brief\s+contents|\bcontents\b/i.test(combined);
  const chapterNumbers = Array.from(new Set(
    Array.from(combined.matchAll(/\b(?:chapter\s+)?(\d{1,3})\s+[A-Z][^\n]{2,120}/gi))
      .map((match) => Number(match[1]))
      .filter((number) => Number.isInteger(number) && number > 0),
  )).sort((a, b) => a - b);

  if (hasContentsMarker && chapterNumbers.length >= 3 && isContiguousFromOne(chapterNumbers)) {
    return 'complete';
  }

  return 'partial';
}

function countDistinctChapterNumbers(content: string): number {
  return new Set(
    Array.from(content.matchAll(/\b(?:chapter\s+)?(\d{1,3})\s+[A-Z][^\n]{2,120}/gi))
      .map((match) => Number(match[1]))
      .filter((number) => Number.isInteger(number) && number > 0),
  ).size;
}

function isContiguousFromOne(numbers: number[]): boolean {
  if (numbers[0] !== 1) return false;
  return numbers.every((number, index) => number === index + 1);
}

function buildStructureMessage(confidence: 'complete' | 'partial' | 'unknown'): string {
  if (confidence === 'complete') {
    return 'Structure evidence appears complete because a contents marker and contiguous chapter sequence were found. Do not claim a final chapter count unless confidence is complete.';
  }
  if (confidence === 'partial') {
    return 'Structure evidence is partial unless the evidence clearly shows a full table of contents or full chapter list. Do not claim a final chapter count unless confidence is complete.';
  }
  return 'No reliable structure evidence was found. Do not claim a final chapter count unless confidence is complete.';
}

function mergeReasons(first: string, second: string): string {
  const parts = new Set([...first.split('; '), ...second.split('; ')]);
  return Array.from(parts).join('; ');
}
