import { BorrowStatus, IndexStatus, ReservationStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService admin snapshot', () => {
  const now = new Date('2026-06-07T12:00:00.000Z');
  let service: DashboardService;
  let prisma: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = createPrismaMock();
    service = new DashboardService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns grouped command summary and indexing health from real aggregate queries', async () => {
    seedSnapshotMocks(prisma);

    const snapshot = await service.getAdminSnapshot();

    expect(snapshot.commandSummary).toEqual({
      totalBooks: 20,
      indexedBooks: 10,
      indexedBooksPercent: 50,
      failedIndexingBooks: 3,
      pendingReservations: 4,
      overdueBorrows: 2,
      pendingMaterials: 5,
      activeUsers: 12,
    });
    expect(snapshot.indexingHealth.byStatus).toEqual([
      { status: 'INDEXED', count: 10, percentage: 50 },
      { status: 'FAILED', count: 3, percentage: 15 },
      { status: 'PENDING', count: 5, percentage: 25 },
      { status: 'PROCESSING', count: 1, percentage: 5 },
      { status: 'NOT_APPLICABLE', count: 1, percentage: 5 },
    ]);
    expect(snapshot.indexingHealth.totalChunks).toBe(80);
    expect(snapshot.indexingHealth.averageChunksPerIndexedBook).toBe(8);
    expect(snapshot.indexingHealth.zeroChunkIndexedBooks).toBe(2);
    expect(snapshot.indexingHealth.lastIndexedAt).toBe('2026-06-06T10:00:00.000Z');
  });

  it('caps failed book preview and does not return chunk content or AI message content', async () => {
    seedSnapshotMocks(prisma);
    const failedBooks = Array.from({ length: 12 }, (_, index) => ({
      id: `book-${index}`,
      title: `Failed ${index}`,
      authors: ['Author'],
      pdfIndexStatus: IndexStatus.FAILED,
      pdfPageCount: index,
      pdfUrl: index % 2 === 0 ? `/uploads/pdfs/${index}.pdf` : null,
      ebookUrl: index % 2 === 1 ? `https://example.edu/${index}.pdf` : null,
      pdfIndexedAt: null,
      _count: { chunks: index },
      chunks: [{ content: 'must not leak' }],
    }));
    prisma.book.findMany.mockImplementation((args: any) => {
      if (args?.where?.pdfIndexStatus === IndexStatus.FAILED) return Promise.resolve(failedBooks);
      return Promise.resolve([]);
    });
    prisma.aiConversation.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        messages: [
          { role: 'user', content: 'secret prompt' },
          { role: 'assistant', content: 'secret answer' },
        ],
      },
    ]);

    const snapshot = await service.getAdminSnapshot();

    expect(snapshot.indexingHealth.failedBooksPreview).toHaveLength(10);
    expect(snapshot.indexingHealth.failedBooksPreview[0]).toEqual({
      id: 'book-0',
      title: 'Failed 0',
      authors: ['Author'],
      pdfIndexStatus: 'FAILED',
      pdfPageCount: 0,
      chunks: 0,
      hasPdfUrl: true,
      hasEbookUrl: false,
      pdfIndexedAt: null,
    });
    expect(JSON.stringify(snapshot)).not.toContain('must not leak');
    expect(JSON.stringify(snapshot)).not.toContain('secret prompt');
    expect(JSON.stringify(snapshot)).not.toContain('secret answer');
  });

  it('includes metadata issue preview with fix links and caps the preview to 10 books', async () => {
    seedSnapshotMocks(prisma);
    const metadataIssues = Array.from({ length: 12 }, (_, index) => ({
      id: `book-${index}`,
      title: `Missing metadata ${index}`,
      authors: [`Author ${index}`],
      isbn: index % 2 === 0 ? null : `isbn-${index}`,
      description: index % 3 === 0 ? null : `Description ${index}`,
      category: index % 4 === 0 ? null : `Category ${index}`,
      subjectTags: index % 5 === 0 ? [] : [`tag-${index}`],
      mainFacultyId: index % 6 === 0 ? null : `faculty-${index}`,
      coverImageUrl: index % 7 === 0 ? null : `/covers/${index}.jpg`,
    }));
    prisma.book.findMany.mockImplementation((args: any) => {
      if (args?.where?.OR && args?.select?.isbn) return Promise.resolve(metadataIssues);
      if (args?.where?.pdfIndexStatus === IndexStatus.FAILED) return Promise.resolve([]);
      if (args?.select?.mainFacultyId) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const snapshot = await service.getAdminSnapshot();

    expect(snapshot.collectionInsights.metadataIssuesPreview).toHaveLength(10);
    expect(snapshot.collectionInsights.metadataIssuesPreview[0]).toEqual({
      id: 'book-0',
      title: 'Missing metadata 0',
      authors: ['Author 0'],
      missingFields: ['ISBN', 'description', 'category', 'subject tags', 'faculty', 'cover image'],
      catalogUrl: '/dashboard/catalog/book-0',
      adminEditUrl: '/dashboard/admin/books/book-0/edit',
    });
    expect(JSON.stringify(snapshot.collectionInsights.metadataIssuesPreview)).not.toContain('/uploads/');
    expect(JSON.stringify(snapshot.collectionInsights.metadataIssuesPreview)).not.toContain('pdfUrl');
    expect(JSON.stringify(snapshot.collectionInsights.metadataIssuesPreview)).not.toContain('ebookUrl');
    expect(JSON.stringify(snapshot.collectionInsights.metadataIssuesPreview)).not.toContain('Description 0');
    expect(JSON.stringify(snapshot.collectionInsights.metadataIssuesPreview)).not.toContain('must not leak');
  });

  it('calculates missing metadata counts and derives overdue only from active borrows past due', async () => {
    seedSnapshotMocks(prisma);

    await service.getAdminSnapshot();

    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, isbn: null } });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, description: null } });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, category: null } });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, subjectTags: { isEmpty: true } } });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, mainFacultyId: null } });
    expect(prisma.book.count).toHaveBeenCalledWith({ where: { isActive: true, coverImageUrl: null } });
    expect(prisma.borrow.count).toHaveBeenCalledWith({
      where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
    });
  });
});

function createPrismaMock() {
  return {
    book: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    bookChunk: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    reservation: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    borrow: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    material: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    materialChunk: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    aiConversation: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
}

function seedSnapshotMocks(prisma: any) {
  prisma.book.count.mockImplementation(({ where }: any = {}) => {
    if (where?.isActive && Object.keys(where).length === 1) return Promise.resolve(20);
    if (where?.pdfIndexStatus === IndexStatus.INDEXED && where?.chunks) return Promise.resolve(2);
    if (where?.pdfIndexStatus === IndexStatus.INDEXED) return Promise.resolve(10);
    if (where?.pdfIndexStatus === IndexStatus.FAILED) return Promise.resolve(3);
    if (where?.isbn === null) return Promise.resolve(1);
    if (where?.description === null) return Promise.resolve(2);
    if (where?.category === null) return Promise.resolve(3);
    if (where?.subjectTags?.isEmpty) return Promise.resolve(4);
    if (where?.mainFacultyId === null) return Promise.resolve(5);
    if (where?.coverImageUrl === null) return Promise.resolve(6);
    return Promise.resolve(0);
  });

  prisma.book.groupBy.mockImplementation(({ by }: any) => {
    if (by.includes('pdfIndexStatus')) {
      return Promise.resolve([
        { pdfIndexStatus: IndexStatus.INDEXED, _count: { _all: 10 } },
        { pdfIndexStatus: IndexStatus.FAILED, _count: { _all: 3 } },
        { pdfIndexStatus: IndexStatus.PENDING, _count: { _all: 5 } },
        { pdfIndexStatus: IndexStatus.PROCESSING, _count: { _all: 1 } },
        { pdfIndexStatus: IndexStatus.NOT_APPLICABLE, _count: { _all: 1 } },
      ]);
    }
    if (by.includes('category')) {
      return Promise.resolve([{ category: 'Computer Science', _count: { _all: 7 } }]);
    }
    return Promise.resolve([]);
  });

  prisma.book.findMany.mockImplementation((args: any) => {
    if (args?.where?.pdfIndexStatus === IndexStatus.FAILED) {
      return Promise.resolve([
        {
          id: 'failed-book',
          title: 'Broken PDF',
          authors: ['A. Writer'],
          pdfIndexStatus: IndexStatus.FAILED,
          pdfPageCount: null,
          pdfUrl: '/uploads/pdfs/broken.pdf',
          ebookUrl: null,
          pdfIndexedAt: null,
          _count: { chunks: 0 },
        },
      ]);
    }
    if (args?.where?.OR && args?.select?.isbn) {
      return Promise.resolve([
        {
          id: 'book-meta-1',
          title: 'Missing Category',
          authors: ['A. Writer'],
          isbn: '978-0-0000-0000-0',
          description: 'Desc',
          category: null,
          subjectTags: ['tag'],
          mainFacultyId: 'faculty-1',
          coverImageUrl: '/covers/meta-1.jpg',
        },
      ]);
    }
    if (args?.select?.mainFacultyId) {
      return Promise.resolve([
        { mainFacultyId: 'faculty-1', mainFaculty: { name: 'Engineering' } },
        { mainFacultyId: null, mainFaculty: null },
      ]);
    }
    if (args?.where?.id?.in) {
      return Promise.resolve([
        { id: 'book-1', title: 'Clean Code' },
        { id: 'book-2', title: 'Design Patterns' },
      ]);
    }
    return Promise.resolve([]);
  });

  prisma.book.aggregate.mockResolvedValue({ _max: { pdfIndexedAt: new Date('2026-06-06T10:00:00.000Z') } });
  prisma.bookChunk.count.mockResolvedValue(80);
  prisma.reservation.count.mockImplementation(({ where }: any = {}) => {
    if (where?.status === ReservationStatus.PENDING) return Promise.resolve(4);
    if (where?.status === ReservationStatus.READY_FOR_PICKUP) return Promise.resolve(2);
    return Promise.resolve(0);
  });
  prisma.reservation.groupBy.mockResolvedValue([
    { bookId: 'book-2', _count: { id: 3 } },
  ]);
  prisma.borrow.count.mockImplementation(({ where }: any = {}) => {
    if (where?.status === BorrowStatus.ACTIVE && where?.dueAt) return Promise.resolve(2);
    if (where?.status === BorrowStatus.ACTIVE) return Promise.resolve(9);
    return Promise.resolve(0);
  });
  prisma.$queryRaw
    .mockResolvedValueOnce([
      { bookId: 'book-1', title: 'Clean Code', borrowCount: BigInt(4) },
    ])
    .mockResolvedValueOnce([
      { bookId: 'book-2', title: 'Design Patterns', reservationCount: BigInt(3) },
    ]);
  prisma.material.count.mockImplementation(({ where }: any = {}) => {
    if (!where) return Promise.resolve(11);
    if (where?.isApproved === false) return Promise.resolve(5);
    if (where?.isApproved === true) return Promise.resolve(6);
    if (where?.isPublished === true) return Promise.resolve(4);
    return Promise.resolve(0);
  });
  prisma.material.groupBy.mockResolvedValue([
    { indexStatus: IndexStatus.INDEXED, _count: { _all: 3 } },
    { indexStatus: IndexStatus.FAILED, _count: { _all: 1 } },
  ]);
  prisma.materialChunk.count.mockResolvedValue(25);
  prisma.user.count.mockResolvedValue(12);
  prisma.aiConversation.findMany.mockResolvedValue([
    { userId: 'user-1', messages: [{ role: 'user' }, { role: 'assistant' }] },
    { userId: 'user-2', messages: [{ role: 'user' }] },
  ]);
}
