import { IndexStatus } from '@prisma/client';
import { BooksService } from './books.service';

describe('BooksService', () => {
  const prisma = {
    book: {
      findMany: jest.fn(),
    },
  };

  const storage = {
    uploadFile: jest.fn(),
  };

  const bookDocumentService = {
    indexBookPdf: jest.fn(),
  };

  let service: BooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(
      prisma as never,
      storage as never,
      bookDocumentService as never,
    );
  });

  it('queues pending PDF books with a bounded limit', async () => {
    prisma.book.findMany.mockResolvedValue([
      { id: 'book-1', title: 'Linux' },
      { id: 'book-2', title: 'Git' },
    ]);
    bookDocumentService.indexBookPdf.mockResolvedValue(undefined);

    const result = await service.queuePendingPdfIndexing('500');

    expect(prisma.book.findMany).toHaveBeenCalledWith({
      where: {
        pdfUrl: { not: null },
        pdfIndexStatus: IndexStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 200,
    });
    expect(bookDocumentService.indexBookPdf).toHaveBeenNthCalledWith(1, 'book-1');
    expect(bookDocumentService.indexBookPdf).toHaveBeenNthCalledWith(2, 'book-2');
    expect(result).toEqual({
      queued: 2,
      limit: 200,
      bookIds: ['book-1', 'book-2'],
    });
  });

  it('uses the default limit when none is provided', async () => {
    prisma.book.findMany.mockResolvedValue([]);

    const result = await service.queuePendingPdfIndexing();

    expect(prisma.book.findMany).toHaveBeenCalledWith({
      where: {
        pdfUrl: { not: null },
        pdfIndexStatus: IndexStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 25,
    });
    expect(result).toEqual({ queued: 0, limit: 25, bookIds: [] });
  });
});
