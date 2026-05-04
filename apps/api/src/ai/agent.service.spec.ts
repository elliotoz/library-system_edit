import { AgentService } from './agent.service';

describe('AgentService read_ebook', () => {
  it('reads managed local PDFs through the book document service', async () => {
    const prisma = {};
    const catalogSearch = {};
    const toolHooks = {};
    const tokenTracker = {};
    const materialSearch = {};
    const bookDocumentService = {
      getPdfDocumentContent: jest.fn().mockResolvedValue({
        title: 'Clean Architecture',
        authors: ['Robert C. Martin'],
        description: 'Software architecture principles',
        category: 'Software Engineering',
        publicationYear: 2017,
        publisher: 'Pearson',
        pageCount: 432,
        text: 'Architecture matters because good boundaries keep systems maintainable.',
      }),
    };

    const service = new AgentService(
      prisma as never,
      catalogSearch as never,
      toolHooks as never,
      tokenTracker as never,
      materialSearch as never,
      bookDocumentService as never,
    );

    const result = await service['executeToolInner'](
      'read_ebook',
      { url: '/uploads/pdfs/clean-architecture.pdf', question: 'main idea' },
      'user-1',
      'STUDENT',
      '',
      {},
    );

    expect(bookDocumentService.getPdfDocumentContent).toHaveBeenCalledWith('/uploads/pdfs/clean-architecture.pdf');
    expect(result.result).toContain('E-BOOK CONTENT');
    expect(result.result).toContain('Clean Architecture');
    expect(result.result).toContain('Architecture matters');
  });
});
