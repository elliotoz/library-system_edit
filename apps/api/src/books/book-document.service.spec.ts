import { IndexStatus } from '@prisma/client';
import { BookDocumentService } from './book-document.service';

describe('BookDocumentService', () => {
  const prisma = {
    book: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
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
    service = new BookDocumentService(prisma as never, documentContent as never);
  });

  it('indexes a managed book PDF into persistent text fields', async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 'book-1',
      title: 'Algorithms',
      pdfUrl: '/uploads/pdfs/algorithms.pdf',
    });
    documentContent.extractFromFileUrl.mockResolvedValue({
      text: 'A'.repeat(300),
      pageCount: 12,
      paragraphs: [],
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
    expect(prisma.book.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'book-1' },
      data: {
        pdfExtractedText: 'A'.repeat(300),
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
});
