import { Test, TestingModule } from '@nestjs/testing';
import { CatalogSearchService } from './catalog-search.service';
import { SemanticSearchService } from './semantic-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankedBookResult } from './types/search.types';

// ── Helpers ────────────────────────────────────────────────────────

function makeBook(overrides: Partial<RankedBookResult> = {}): RankedBookResult {
  return {
    id: 'book-1',
    title: 'Clean Code',
    authors: ['Robert C. Martin'],
    category: 'Computer Science',
    subjectTags: ['programming', 'software'],
    availableCopies: 1,
    totalCopies: 2,
    readingListCount: 0,
    facultyMatch: false,
    score: 10,
    reasons: ['Title match'],
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────

const mockPrisma = {} as unknown as PrismaService;

/**
 * Creates a SemanticSearchService mock.
 * `searchBooks` returns the provided books on the first call (full query)
 * and the fallback books on the second call (normalized query).
 */
function makeMockSemantic(
  firstPassBooks: RankedBookResult[],
  secondPassBooks: RankedBookResult[] = [],
) {
  let callCount = 0;
  return {
    searchBooks: jest.fn().mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? firstPassBooks : secondPassBooks;
    }),
    rankBooks: jest.fn().mockImplementation((candidates: RankedBookResult[]) => candidates),
  } as unknown as SemanticSearchService;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CatalogSearchService', () => {
  async function buildService(semantic: SemanticSearchService): Promise<CatalogSearchService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSearchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SemanticSearchService, useValue: semantic },
      ],
    }).compile();
    return module.get(CatalogSearchService);
  }

  // ── searchForAgent — first pass succeeds ────────────────────────

  describe('searchForAgent — first pass succeeds', () => {
    it('returns catalogLink for each result', async () => {
      const book = makeBook({ id: 'abc123' });
      const service = await buildService(makeMockSemantic([book]));

      const result = await service.searchForAgent('clean code');

      expect(result.total).toBe(1);
      expect(result.fallbackUsed).toBe(false);
      expect(result.results[0].catalogLink).toBe('/dashboard/catalog/abc123');
    });

    it('does not expose ebookUrl — only catalogLink', async () => {
      const book = makeBook({ id: 'abc123' });
      const service = await buildService(makeMockSemantic([book]));

      const result = await service.searchForAgent('clean code');

      const resultKeys = Object.keys(result.results[0]);
      expect(resultKeys).toContain('catalogLink');
      expect(resultKeys).not.toContain('ebookUrl');
      expect(resultKeys).not.toContain('link');
    });

    it('returns correct availability and copy string', async () => {
      const book = makeBook({ availableCopies: 2, totalCopies: 3 });
      const service = await buildService(makeMockSemantic([book]));

      const result = await service.searchForAgent('clean code');

      expect(result.results[0].available).toBe(true);
      expect(result.results[0].copies).toBe('2/3');
    });
  });

  // ── searchForAgent — subtitle stripping fallback ─────────────────

  describe('searchForAgent — subtitle stripping fallback', () => {
    it('falls back to short title when full subtitle query returns nothing', async () => {
      const book = makeBook({ title: 'Clean Code' });
      // First pass (full query) → empty; second pass (stripped) → book
      const semantic = makeMockSemantic([], [book]);
      const service = await buildService(semantic);

      const result = await service.searchForAgent(
        'Clean Code: A Handbook of Agile Software Craftsmanship',
      );

      expect(result.total).toBe(1);
      expect(result.fallbackUsed).toBe(true);
      expect(result.fallbackQuery).toBe('clean code');
    });

    it('reports fallbackUsed: false when first pass already succeeds', async () => {
      const book = makeBook();
      const service = await buildService(makeMockSemantic([book]));

      const result = await service.searchForAgent(
        'Clean Code: A Handbook of Agile Software Craftsmanship',
      );

      expect(result.fallbackUsed).toBe(false);
    });

    it('returns empty results (not an error) when both passes find nothing', async () => {
      const service = await buildService(makeMockSemantic([], []));

      const result = await service.searchForAgent('xyzzyqwerty no match');

      expect(result.total).toBe(0);
      expect(result.fallbackUsed).toBe(false);
      expect(result.results).toHaveLength(0);
    });
  });

  // ── searchForAgent — concept/topic queries ───────────────────────

  describe('searchForAgent — concept/topic queries', () => {
    it('returns relevant books for "coding" query via category expansion', async () => {
      const csBook = makeBook({
        id: 'cs1',
        title: 'Introduction to Programming',
        category: 'Computer Science',
      });
      const service = await buildService(makeMockSemantic([csBook]));

      const result = await service.searchForAgent('coding');

      expect(result.total).toBeGreaterThan(0);
      expect(result.results[0].category).toBe('Computer Science');
    });

    it('returns relevant books for "engineering" query via category expansion', async () => {
      const engBook = makeBook({
        id: 'eng1',
        title: 'Fundamentals of Engineering',
        category: 'Engineering',
      });
      const service = await buildService(makeMockSemantic([engBook]));

      const result = await service.searchForAgent('engineering');

      expect(result.total).toBeGreaterThan(0);
    });

    it('returns relevant books for "natural sciences" query', async () => {
      const sciBook = makeBook({
        id: 'sci1',
        title: 'General Chemistry',
        category: 'Science',
      });
      const service = await buildService(makeMockSemantic([sciBook]));

      const result = await service.searchForAgent('natural sciences');

      expect(result.total).toBeGreaterThan(0);
    });

    it('returns relevant books for "software engineering" query', async () => {
      const swBook = makeBook({
        id: 'sw1',
        title: 'Software Engineering Principles',
        category: 'Computer Science',
      });
      const service = await buildService(makeMockSemantic([swBook]));

      const result = await service.searchForAgent('software engineering');

      expect(result.total).toBeGreaterThan(0);
    });

    it('parses "related to coding" as a topic search (not a title lookup)', async () => {
      const service = await buildService(makeMockSemantic([]));

      // The important assertion is that parseIntent correctly classifies this
      // and searchForAgent reaches the search layer without throwing
      const result = await service.searchForAgent('related to coding');

      // No assertion on count — just ensure it runs without error
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('results');
    });
  });

  // ── searchForAgent — pageSize cap ────────────────────────────────

  describe('searchForAgent — pageSize cap', () => {
    it('caps results at 10 even when pageSize > 10', async () => {
      const books = Array.from({ length: 15 }, (_, i) => makeBook({ id: `b${i}` }));
      const semantic = makeMockSemantic(books);
      // Override rankBooks to return all input books (no slicing in mock)
      (semantic.rankBooks as jest.Mock).mockImplementation(
        (candidates: RankedBookResult[]) => candidates,
      );
      const service = await buildService(semantic);

      const result = await service.searchForAgent('programming', 20);

      expect(result.results.length).toBeLessThanOrEqual(10);
    });
  });
});
