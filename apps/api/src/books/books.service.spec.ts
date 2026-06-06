import { IndexStatus } from '@prisma/client';
import { BooksService } from './books.service';

describe('BooksService', () => {
  const prisma = {
    $transaction: jest.fn(),
    book: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    bookCopy: {
      createMany: jest.fn(),
    },
    libraryBranch: {
      findMany: jest.fn(),
    },
    bookChunk: {
      deleteMany: jest.fn(),
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
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input({
          book: prisma.book,
          bookCopy: prisma.bookCopy,
        });
      }
      return Promise.all(input as Array<Promise<unknown>>);
    });
    prisma.book.findUnique.mockResolvedValue(null);
    prisma.book.update.mockResolvedValue({});
    prisma.book.create.mockResolvedValue({ id: 'book-new' });
    prisma.bookCopy.createMany.mockResolvedValue({ count: 0 });
    prisma.libraryBranch.findMany.mockResolvedValue([]);
    prisma.bookChunk.deleteMany.mockResolvedValue({ count: 0 });
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
        OR: [
          { pdfUrl: { not: null } },
          { ebookUrl: { endsWith: '.pdf', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf?', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf#', mode: 'insensitive' } },
        ],
        pdfIndexStatus: {
          in: [
            IndexStatus.PENDING,
            IndexStatus.FAILED,
            IndexStatus.NOT_APPLICABLE,
          ],
        },
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
        OR: [
          { pdfUrl: { not: null } },
          { ebookUrl: { endsWith: '.pdf', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf?', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf#', mode: 'insensitive' } },
        ],
        pdfIndexStatus: {
          in: [
            IndexStatus.PENDING,
            IndexStatus.FAILED,
            IndexStatus.NOT_APPLICABLE,
          ],
        },
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

  it('does not queue HTML ebook-only books', async () => {
    prisma.book.findMany.mockResolvedValue([]);

    await service.queuePendingPdfIndexing();

    expect(prisma.book.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { pdfUrl: { not: null } },
          { ebookUrl: { endsWith: '.pdf', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf?', mode: 'insensitive' } },
          { ebookUrl: { contains: '.pdf#', mode: 'insensitive' } },
        ],
      }),
    }));
  });

  it('creates books with PDF-like ebookUrl as pending for indexing', async () => {
    const findByIdSpy = jest.spyOn(service, 'findById').mockResolvedValue({ id: 'book-new' } as never);

    await service.create({
      title: 'Pro Git',
      authors: ['Scott Chacon'],
      isEbookAvailable: true,
      ebookUrl: 'https://example.com/progit.pdf?download=1',
      branches: [],
    });

    expect(prisma.book.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ebookUrl: 'https://example.com/progit.pdf?download=1',
        pdfIndexStatus: IndexStatus.PENDING,
      }),
    });
    expect(findByIdSpy).toHaveBeenCalledWith('book-new');
  });

  it('updates books changing ebookUrl to PDF-like as pending and clears cached text', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-1',
      isbn: null,
      pdfUrl: null,
      ebookUrl: 'https://example.com/book.html',
    });
    prisma.book.update.mockResolvedValue({ id: 'book-1' });

    await service.update('book-1', {
      ebookUrl: 'https://example.com/book.pdf',
    });

    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-1' } });
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: expect.objectContaining({
        ebookUrl: 'https://example.com/book.pdf',
        pdfIndexStatus: IndexStatus.PENDING,
        pdfExtractedText: null,
        pdfIndexedAt: null,
        pdfPageCount: null,
      }),
      include: {
        mainFaculty: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('updates books changing ebookUrl to non-PDF as not applicable and clears chunks', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-2',
      isbn: null,
      pdfUrl: null,
      ebookUrl: 'https://example.com/book.pdf',
    });
    prisma.book.update.mockResolvedValue({ id: 'book-2' });

    await service.update('book-2', {
      ebookUrl: 'https://example.com/book.html',
    });

    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-2' } });
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-2' },
      data: expect.objectContaining({
        ebookUrl: 'https://example.com/book.html',
        pdfIndexStatus: IndexStatus.NOT_APPLICABLE,
        pdfExtractedText: null,
        pdfIndexedAt: null,
        pdfPageCount: null,
      }),
      include: {
        mainFaculty: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('keeps uploaded pdfUrl reindex behavior pending', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ id: 'book-3' });
    storage.uploadFile.mockResolvedValue('/uploads/pdfs/book.pdf');

    await service.uploadPdf('book-3', {} as Express.Multer.File);

    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-3' },
      data: {
        pdfUrl: '/uploads/pdfs/book.pdf',
        pdfExtractedText: null,
        pdfIndexStatus: IndexStatus.PENDING,
        pdfIndexedAt: null,
        pdfPageCount: null,
      },
    });
    expect(bookDocumentService.indexBookPdf).toHaveBeenCalledWith('book-3');
  });
});
