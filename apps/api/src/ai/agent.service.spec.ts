import { AgentService } from './agent.service';

function makeAgentService(overrides: {
  prisma?: unknown;
  tokenTracker?: unknown;
  pythonExecution?: unknown;
} = {}) {
  const prisma = overrides.prisma ?? {};
  const catalogSearch = {};
  const toolHooks = {};
  const tokenTracker = overrides.tokenTracker ?? { record: jest.fn() };
  const materialSearch = {};
  const bookDocumentService = {};
  const pythonExecution = overrides.pythonExecution ?? { isAvailable: jest.fn().mockReturnValue(false) };

  return new AgentService(
    prisma as never,
    catalogSearch as never,
    toolHooks as never,
    tokenTracker as never,
    materialSearch as never,
    bookDocumentService as never,
    pythonExecution as never,
  );
}

describe('AgentService read_ebook', () => {
  it('reads managed local PDFs through the book document service', async () => {
    const prisma = {};
    const catalogSearch = {};
    const toolHooks = {};
    const tokenTracker = {};
    const materialSearch = {};
    const pythonExecution = { isAvailable: jest.fn().mockReturnValue(false) };
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
      pythonExecution as never,
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

describe('AgentService conversation memory helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the newest 50 conversation messages and returns chronological order', async () => {
    const returnedNewestFirst = [
      { role: 'assistant', content: 'newest' },
      { role: 'user', content: 'middle' },
      { role: 'assistant', content: 'oldest of selected' },
    ];
    const findMany = jest.fn().mockResolvedValue(returnedNewestFirst);
    const service = makeAgentService({
      prisma: { aiMessage: { findMany } },
    });

    const result = await service['getRecentConversationMessages']('user-1', 'conv-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', conversationId: 'conv-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { role: true, content: true },
    });
    expect(result.map((m) => m.content)).toEqual(['oldest of selected', 'middle', 'newest']);
  });

  it('caps full recall fetches at 300 messages and reports truncation', async () => {
    const rows = [
      { role: 'assistant', content: 'latest' },
      { role: 'user', content: 'previous' },
    ];
    const count = jest.fn().mockResolvedValue(301);
    const findMany = jest.fn().mockResolvedValue(rows);
    const service = makeAgentService({
      prisma: { aiMessage: { count, findMany } },
    });

    const result = await service['getRecallMessagesForConversation']('user-1', 'conv-1');

    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user-1', conversationId: 'conv-1' },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', conversationId: 'conv-1' },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { role: true, content: true },
    });
    expect(result.totalCount).toBe(301);
    expect(result.truncated).toBe(true);
    expect(result.messages.map((m) => m.content)).toEqual(['previous', 'latest']);
  });

  it('does not mark recall as truncated when fetched messages cover the total', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const findMany = jest.fn().mockResolvedValue([
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'first' },
    ]);
    const service = makeAgentService({
      prisma: { aiMessage: { count, findMany } },
    });

    const result = await service['getRecallMessagesForConversation']('user-1', 'conv-1');

    expect(result.truncated).toBe(false);
    expect(result.messages.map((m) => m.content)).toEqual(['first', 'second']);
  });

  it('records token usage when recall completion succeeds', async () => {
    const record = jest.fn();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: ' Recall summary. ' } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      }),
    } as never);
    const service = makeAgentService({
      tokenTracker: { record },
    });

    const result = await service['completeRecallPrompt']({
      userId: 'user-1',
      conversationId: 'conv-1',
      model: 'test-model',
      messages: [{ role: 'user', content: 'summarize' }],
      maxTokens: 100,
      fallbackText: 'fallback',
    });

    expect(result).toBe('Recall summary.');
    expect(fetchMock).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith('user-1', 'conv-1', {
      provider: 'openrouter',
      model: 'test-model',
      inputTokens: 12,
      outputTokens: 4,
    });
  });

  it('returns fallback text when recall completion provider call fails', async () => {
    const record = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('provider down'),
    } as never);
    const service = makeAgentService({
      tokenTracker: { record },
    });

    const result = await service['completeRecallPrompt']({
      userId: 'user-1',
      conversationId: 'conv-1',
      model: 'test-model',
      messages: [{ role: 'user', content: 'summarize' }],
      maxTokens: 100,
      fallbackText: 'safe fallback',
    });

    expect(result).toBe('safe fallback');
    expect(record).not.toHaveBeenCalled();
  });
});
describe('AgentService read_ebook structure questions', () => {
  it('returns a focused table-of-contents excerpt for chapter questions', async () => {
    const prisma = {};
    const catalogSearch = {};
    const toolHooks = {};
    const tokenTracker = {};
    const materialSearch = {};
    const pythonExecution = { isAvailable: jest.fn().mockReturnValue(false) };
    const bookDocumentService = {
      getPdfDocumentContent: jest.fn().mockResolvedValue({
        title: 'The Linux Command Line',
        authors: ['William Shotts'],
        description: 'A complete Linux CLI guide',
        category: 'Operating Systems',
        publicationYear: 2019,
        publisher: 'No Starch Press',
        pageCount: 555,
        text: [
          'Front Matter',
          'Table of Contents',
          'Part 1 Getting Started',
          'Chapter 1 What Is the Shell?',
          'Chapter 2 Navigation',
          'Chapter 3 Exploring the System',
          'Part 2 Configuration and the Environment',
          'Chapter 4 Manipulating Files and Directories',
        ].join('\n'),
      }),
    };

    const service = new AgentService(
      prisma as never,
      catalogSearch as never,
      toolHooks as never,
      tokenTracker as never,
      materialSearch as never,
      bookDocumentService as never,
      pythonExecution as never,
    );

    const result = await service['executeToolInner'](
      'read_ebook',
      { url: 'https://example.com/linux-command-line.pdf', question: 'What are the chapters in this book? Show the table of contents.' },
      'user-1',
      'STUDENT',
      '',
      {},
    );

    expect(result.result).toContain('BOOK STRUCTURE');
    expect(result.result).toContain('Table of Contents');
    expect(result.result).toContain('Chapter 1 What Is the Shell?');
    expect(result.result).toContain('Part 2 Configuration and the Environment');
  });
});

