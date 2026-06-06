import { IndexStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { BookDocumentService } from './book-document.service';

describe('BookDocumentService', () => {
  const prisma = {
    $transaction: jest.fn(),
    book: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    bookChunk: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  const documentContent = {
    isSupportedDocument: jest.fn(),
    getExtension: jest.fn(),
    extractFromFileUrl: jest.fn(),
  };

  let service: BookDocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.book.update.mockResolvedValue({});
    prisma.bookChunk.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bookChunk.createMany.mockResolvedValue({ count: 0 });
    service = new BookDocumentService(prisma as never, documentContent as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('indexes a managed book PDF into persistent text fields and chunks', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-1',
      title: 'Algorithms',
      pdfUrl: '/uploads/pdfs/algorithms.pdf',
      ebookUrl: null,
    });
    documentContent.extractFromFileUrl.mockResolvedValue({
      text: `${'alpha '.repeat(710)}\n\n${'beta '.repeat(120)}`,
      pageCount: 12,
      paragraphs: [
        { text: 'alpha '.repeat(710).trim(), pageNumber: 1 },
        { text: 'beta '.repeat(120).trim(), pageNumber: 2 },
      ],
      sourceType: 'pdf',
    });

    await service.indexBookPdf('book-1');

    expect(prisma.book.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'book-1' },
      data: {
        pdfIndexStatus: IndexStatus.PROCESSING,
        pdfExtractedText: null,
      },
    });
    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-1' } });
    expect(prisma.bookChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookId: 'book-1',
          chunkIndex: 0,
          content: 'alpha '.repeat(710).trim(),
          tokenCount: expect.any(Number),
          pageNumber: 1,
        },
        {
          bookId: 'book-1',
          chunkIndex: 1,
          content: `${'alpha '.repeat(80)}${'beta '.repeat(120)}`.trim(),
          tokenCount: expect.any(Number),
          pageNumber: 2,
        },
      ],
    });
    expect(prisma.book.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'book-1' },
      data: {
        pdfExtractedText: `${'alpha '.repeat(710)}\n\n${'beta '.repeat(120)}`,
        pdfIndexStatus: IndexStatus.INDEXED,
        pdfIndexedAt: expect.any(Date),
        pdfPageCount: 12,
      },
    });
  });

  it('returns on-demand indexed text for managed PDFs when cached text is missing', async () => {
    prisma.book.findFirst.mockResolvedValue({
      id: 'book-1',
      title: 'Distributed Systems',
      authors: ['Tanenbaum'],
      description: 'A systems text',
      category: 'CS',
      publicationYear: 2022,
      publisher: 'Pearson',
      pdfUrl: '/uploads/pdfs/ds.pdf',
      ebookUrl: null,
      pdfExtractedText: null,
      pdfIndexStatus: IndexStatus.PENDING,
      pdfPageCount: null,
    });
    const indexSpy = jest.spyOn(service, 'indexBookPdf').mockResolvedValue();
    prisma.book.findUnique.mockResolvedValue({
      title: 'Distributed Systems',
      authors: ['Tanenbaum'],
      description: 'A systems text',
      category: 'CS',
      publicationYear: 2022,
      publisher: 'Pearson',
      pdfExtractedText: 'B'.repeat(250),
      pdfPageCount: 8,
    });

    const result = await service.getPdfDocumentContent('/uploads/pdfs/ds.pdf');

    expect(indexSpy).toHaveBeenCalledWith('book-1');
    expect(result?.text).toBe('B'.repeat(250));
    expect(result?.pageCount).toBe(8);
  });

  it('indexes a PDF ebookUrl when pdfUrl is missing', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-2',
      title: 'Pro Git',
      pdfUrl: null,
      ebookUrl: 'https://example.com/progit.pdf?download=1',
    });
    documentContent.extractFromFileUrl.mockResolvedValue({
      text: 'git '.repeat(220),
      pageCount: 456,
      paragraphs: [{ text: 'git '.repeat(220).trim(), pageNumber: 10 }],
      sourceType: 'pdf',
    });

    await service.indexBookPdf('book-2');

    expect(documentContent.extractFromFileUrl).toHaveBeenCalledWith('https://example.com/progit.pdf?download=1');
    expect(prisma.bookChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookId: 'book-2',
          chunkIndex: 0,
          content: 'git '.repeat(220).trim(),
          tokenCount: expect.any(Number),
          pageNumber: 10,
        },
      ],
    });
    expect(prisma.book.update).toHaveBeenLastCalledWith({
      where: { id: 'book-2' },
      data: {
        pdfExtractedText: 'git '.repeat(220),
        pdfIndexStatus: IndexStatus.INDEXED,
        pdfIndexedAt: expect.any(Date),
        pdfPageCount: 456,
      },
    });
  });

  it('marks non-PDF ebook-only books not applicable and clears stale chunks', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-3',
      title: 'HTML Book',
      pdfUrl: null,
      ebookUrl: 'https://example.com/book.html',
    });

    await service.indexBookPdf('book-3');

    expect(documentContent.extractFromFileUrl).not.toHaveBeenCalled();
    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-3' } });
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-3' },
      data: {
        pdfIndexStatus: IndexStatus.NOT_APPLICABLE,
        pdfExtractedText: null,
        pdfIndexedAt: null,
        pdfPageCount: null,
      },
    });
  });

  it('clears stale chunks when extraction returns too little text', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-4',
      title: 'Scanned PDF',
      pdfUrl: '/uploads/pdfs/scanned.pdf',
      ebookUrl: null,
    });
    documentContent.extractFromFileUrl.mockResolvedValue({
      text: 'short',
      pageCount: 20,
      paragraphs: [{ text: 'short', pageNumber: 1 }],
      sourceType: 'pdf',
    });

    await service.indexBookPdf('book-4');

    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-4' } });
    expect(prisma.bookChunk.createMany).not.toHaveBeenCalled();
    expect(prisma.book.update).toHaveBeenLastCalledWith({
      where: { id: 'book-4' },
      data: {
        pdfIndexStatus: IndexStatus.FAILED,
        pdfExtractedText: null,
        pdfIndexedAt: null,
        pdfPageCount: 20,
      },
    });
  });

  it('clears stale chunks when extraction throws', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-5',
      title: 'Broken PDF',
      pdfUrl: '/uploads/pdfs/broken.pdf',
      ebookUrl: null,
    });
    documentContent.extractFromFileUrl.mockRejectedValue(new Error('parse failed'));

    await service.indexBookPdf('book-5');

    expect(prisma.bookChunk.deleteMany).toHaveBeenCalledWith({ where: { bookId: 'book-5' } });
    expect(prisma.book.update).toHaveBeenLastCalledWith({
      where: { id: 'book-5' },
      data: {
        pdfIndexStatus: IndexStatus.FAILED,
        pdfExtractedText: null,
        pdfIndexedAt: null,
      },
    });
  });
});
