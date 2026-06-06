import { IndexStatus } from '@prisma/client';
import { BookContentSearchService } from './book-content-search.service';

describe('BookContentSearchService', () => {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
    book: {
      findFirst: jest.fn(),
    },
    bookChunk: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: BookContentSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookContentSearchService(prisma as never);
  });

  it('searchBookChunks returns matching chunks for a query', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        chunkId: 'chunk-1',
        bookId: 'book-1',
        chunkIndex: 2,
        pageNumber: 12,
        content: 'PostgreSQL indexing content',
        rank: 0.42,
        title: 'Database Systems',
        authors: ['A. Author'],
      },
    ]);

    const result = await service.searchBookChunks({ query: 'postgres indexing' });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('b."isActive" = true'),
      'postgres indexing',
    );
    expect(result).toEqual([
      {
        chunkId: 'chunk-1',
        bookId: 'book-1',
        title: 'Database Systems',
        authors: ['A. Author'],
        chunkIndex: 2,
        pageNumber: 12,
        content: 'PostgreSQL indexing content',
        rank: 0.42,
      },
    ]);
  });

  it('searchBookChunks respects bookId filter', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await service.searchBookChunks({
      query: 'transactions',
      bookId: 'book-2',
      limit: 3,
    });

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('bc."bookId" = $2'),
      'transactions',
      'book-2',
    );
  });

  it('searchBookChunks ignores inactive books', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await service.searchBookChunks({ query: 'algorithms' });

    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('JOIN books b ON b.id = bc."bookId"');
    expect(sql).toContain('b."isActive" = true');
  });

  it('searchBookChunks caps limit', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await service.searchBookChunks({ query: 'network', limit: 50 });

    const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT 10');
  });

  it('searchBookChunks returns empty results for empty queries', async () => {
    const result = await service.searchBookChunks({ query: '  ' });

    expect(result).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('getBookChunkContext returns neighboring chunks in order', async () => {
    prisma.bookChunk.findFirst.mockResolvedValue({
      id: 'chunk-2',
      bookId: 'book-1',
      chunkIndex: 2,
      book: { id: 'book-1', title: 'Clean Architecture', authors: ['Robert C. Martin'] },
    });
    prisma.bookChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        bookId: 'book-1',
        chunkIndex: 1,
        pageNumber: 5,
        content: 'Before',
      },
      {
        id: 'chunk-2',
        bookId: 'book-1',
        chunkIndex: 2,
        pageNumber: 6,
        content: 'Current',
      },
      {
        id: 'chunk-3',
        bookId: 'book-1',
        chunkIndex: 3,
        pageNumber: 7,
        content: 'After',
      },
    ]);

    const result = await service.getBookChunkContext({
      bookId: 'book-1',
      chunkIndex: 2,
      before: 5,
      after: 5,
    });

    expect(prisma.bookChunk.findMany).toHaveBeenCalledWith({
      where: {
        bookId: 'book-1',
        book: { isActive: true },
        chunkIndex: { gte: -1, lte: 5 },
      },
      orderBy: { chunkIndex: 'asc' },
      select: {
        id: true,
        bookId: true,
        chunkIndex: true,
        pageNumber: true,
        content: true,
      },
    });
    expect(result.book).toEqual({
      id: 'book-1',
      title: 'Clean Architecture',
      authors: ['Robert C. Martin'],
    });
    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([1, 2, 3]);
  });

  it('getBookOutline returns first chunks and metadata', async () => {
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-1',
      title: 'Pro Git',
      authors: ['Scott Chacon'],
      pdfPageCount: 456,
      pdfIndexStatus: IndexStatus.INDEXED,
      _count: { chunks: 20 },
    });
    prisma.bookChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-0',
        bookId: 'book-1',
        chunkIndex: 0,
        pageNumber: 1,
        content: 'Opening content',
      },
    ]);

    const result = await service.getBookOutline({ bookId: 'book-1', limit: 50 });

    expect(prisma.book.findFirst).toHaveBeenCalledWith({
      where: { id: 'book-1', isActive: true },
      select: {
        id: true,
        title: true,
        authors: true,
        pdfPageCount: true,
        pdfIndexStatus: true,
        _count: { select: { chunks: true } },
      },
    });
    expect(prisma.bookChunk.findMany).toHaveBeenCalledWith({
      where: {
        bookId: 'book-1',
        book: { isActive: true },
      },
      orderBy: { chunkIndex: 'asc' },
      take: 10,
      select: {
        id: true,
        bookId: true,
        chunkIndex: true,
        pageNumber: true,
        content: true,
      },
    });
    expect(result.book).toEqual({
      id: 'book-1',
      title: 'Pro Git',
      authors: ['Scott Chacon'],
      pdfPageCount: 456,
      pdfIndexStatus: IndexStatus.INDEXED,
      totalChunkCount: 20,
    });
    expect(result.chunks).toEqual([
      {
        chunkId: 'chunk-0',
        bookId: 'book-1',
        chunkIndex: 0,
        pageNumber: 1,
        content: 'Opening content',
      },
    ]);
  });

  it('findBookStructure returns early chunks and keyword evidence with chunk and page metadata', async () => {
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-1',
      title: 'Building Java Programs',
      authors: ['Stuart Reges', 'Marty Stepp'],
      pdfPageCount: 1234,
      pdfIndexStatus: IndexStatus.INDEXED,
      _count: { chunks: 80 },
    });
    prisma.bookChunk.findMany
      .mockResolvedValueOnce([
        {
          id: 'chunk-0',
          bookId: 'book-1',
          chunkIndex: 0,
          pageNumber: 4,
          content: [
            'Brief Contents',
            '1 Introduction to Java Programming',
            '2 Primitive Data and Definite Loops',
            '3 Introduction to Parameters and Objects',
            '4 Conditional Execution',
          ].join('\n'),
        },
        {
          id: 'chunk-1',
          bookId: 'book-1',
          chunkIndex: 1,
          pageNumber: 5,
          content: 'Preface overview for instructors',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'chunk-20',
          bookId: 'book-1',
          chunkIndex: 20,
          pageNumber: 122,
          content: 'Chapter 2 Primitive Data and Definite Loops body text',
        },
      ]);

    const result = await service.findBookStructure({ bookId: 'book-1', limit: 2 });

    expect(prisma.book.findFirst).toHaveBeenCalledWith({
      where: { id: 'book-1', isActive: true },
      select: {
        id: true,
        title: true,
        authors: true,
        pdfPageCount: true,
        pdfIndexStatus: true,
        _count: { select: { chunks: true } },
      },
    });
    expect(prisma.bookChunk.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        bookId: 'book-1',
        book: { isActive: true },
      },
      orderBy: { chunkIndex: 'asc' },
      take: 40,
      select: {
        id: true,
        bookId: true,
        chunkIndex: true,
        pageNumber: true,
        content: true,
      },
    });
    expect(prisma.bookChunk.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        bookId: 'book-1',
        book: { isActive: true },
      }),
      take: 20,
    }));
    expect(result.book).toEqual({
      id: 'book-1',
      title: 'Building Java Programs',
      authors: ['Stuart Reges', 'Marty Stepp'],
      pdfPageCount: 1234,
      pdfIndexStatus: IndexStatus.INDEXED,
      totalChunks: 80,
    });
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toEqual(expect.objectContaining({
      chunkId: 'chunk-0',
      chunkIndex: 0,
      pageNumber: 4,
      reason: expect.stringContaining('early chunk'),
      excerpt: expect.stringContaining('Brief Contents'),
    }));
    expect(result.confidence).toBe('complete');
    expect(result.message).toContain('Do not claim a final chapter count unless confidence is complete');
  });

  it('findBookStructure respects active books and returns unknown when the book is unavailable', async () => {
    prisma.book.findFirst.mockResolvedValue(null);

    const result = await service.findBookStructure({ bookId: 'missing-book' });

    expect(prisma.book.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'missing-book', isActive: true },
    }));
    expect(prisma.bookChunk.findMany).not.toHaveBeenCalled();
    expect(result.book).toBeNull();
    expect(result.evidence).toEqual([]);
    expect(result.confidence).toBe('unknown');
  });

  it('findBookStructure returns partial when chapter evidence exists without a clear full TOC', async () => {
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-2',
      title: 'Partial Book',
      authors: [],
      pdfPageCount: null,
      pdfIndexStatus: IndexStatus.INDEXED,
      _count: { chunks: 12 },
    });
    prisma.bookChunk.findMany
      .mockResolvedValueOnce([
        {
          id: 'chunk-2',
          bookId: 'book-2',
          chunkIndex: 2,
          pageNumber: 18,
          content: 'Chapter 2 Loops are discussed here.',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.findBookStructure({ bookId: 'book-2' });

    expect(result.confidence).toBe('partial');
    expect(result.message).toContain('partial unless the evidence clearly shows a full table of contents');
    expect(result.evidence[0].reason).toContain('chapter-like pattern');
  });

  it('findBookStructure caps evidence limit', async () => {
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-3',
      title: 'Large Book',
      authors: [],
      pdfPageCount: null,
      pdfIndexStatus: IndexStatus.INDEXED,
      _count: { chunks: 50 },
    });
    const chunks = Array.from({ length: 15 }, (_, index) => ({
      id: `chunk-${index}`,
      bookId: 'book-3',
      chunkIndex: index,
      pageNumber: index + 1,
      content: `Chapter ${index + 1} Topic ${index + 1}`,
    }));
    prisma.bookChunk.findMany.mockResolvedValueOnce(chunks).mockResolvedValueOnce([]);

    const result = await service.findBookStructure({ bookId: 'book-3', limit: 50 });

    expect(result.evidence).toHaveLength(12);
  });
});
