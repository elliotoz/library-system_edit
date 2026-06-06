import { AgentService } from './agent.service';
import { Role } from '@prisma/client';

function makeAgentService(overrides: {
  prisma?: unknown;
  tokenTracker?: unknown;
  pythonExecution?: unknown;
  materialSearch?: unknown;
  bookContentSearch?: unknown;
} = {}) {
  const prisma = overrides.prisma ?? {};
  const catalogSearch = {};
  const toolHooks = {};
  const tokenTracker = overrides.tokenTracker ?? { record: jest.fn() };
  const materialSearch = overrides.materialSearch ?? {};
  const bookDocumentService = {};
  const bookContentSearch = overrides.bookContentSearch ?? {};
  const pythonExecution = overrides.pythonExecution ?? { isAvailable: jest.fn().mockReturnValue(false) };

  return new AgentService(
    prisma as never,
    catalogSearch as never,
    toolHooks as never,
    tokenTracker as never,
    materialSearch as never,
    bookDocumentService as never,
    bookContentSearch as never,
    pythonExecution as never,
  );
}

function makeChatPrisma(role: Role) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Ada',
        role,
        interests: [],
        courses: [],
        faculty: null,
        borrows: [],
      }),
    },
    borrowPolicy: {
      findUnique: jest.fn().mockResolvedValue({
        maxActiveBorrows: 5,
        maxBorrowDays: 14,
        maxExtensions: 2,
      }),
    },
    book: { count: jest.fn().mockResolvedValue(5) },
    bookCopy: { count: jest.fn().mockResolvedValue(67) },
    readingList: { count: jest.fn().mockResolvedValue(0) },
    aiMessage: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeAdminAnalyticsPrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Admin',
        role: Role.ADMIN,
        interests: [],
        courses: [],
        faculty: null,
        borrows: [],
      }),
    },
    borrowPolicy: {
      findUnique: jest.fn().mockResolvedValue({
        maxActiveBorrows: 20,
        maxBorrowDays: 30,
        maxExtensions: 3,
      }),
    },
    book: { count: jest.fn().mockResolvedValue(5) },
    bookCopy: { count: jest.fn().mockResolvedValue(67) },
    readingList: { count: jest.fn().mockResolvedValue(2) },
    aiMessage: {
      create: jest.fn().mockResolvedValue({}),
    },
    borrow: {
      findMany: jest.fn()
        .mockResolvedValueOnce([
          { user: { faculty: { name: 'Engineering', code: 'ENG' } } },
          { user: { faculty: { name: 'Medicine', code: 'MED' } } },
          { user: { faculty: { name: 'Engineering', code: 'ENG' } } },
        ])
        .mockResolvedValueOnce([
          { dueAt: new Date('2026-05-01T00:00:00.000Z') },
          { dueAt: new Date('2026-05-03T00:00:00.000Z') },
        ]),
    },
    reservation: {
      findMany: jest.fn().mockResolvedValue([
        { createdAt: new Date('2026-05-05T00:00:00.000Z') },
        { createdAt: new Date('2026-05-06T00:00:00.000Z') },
      ]),
    },
    finePayment: {
      findMany: jest.fn().mockResolvedValue([
        { amount: '12.50', paidAt: new Date('2026-05-10T00:00:00.000Z') },
        { amount: '7.50', paidAt: new Date('2026-05-11T00:00:00.000Z') },
      ]),
    },
  };
}

function makeMostBorrowedCategoryPrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Admin',
        role: Role.ADMIN,
        interests: [],
        courses: [],
        faculty: null,
        borrows: [],
      }),
    },
    borrowPolicy: {
      findUnique: jest.fn().mockResolvedValue({
        maxActiveBorrows: 20,
        maxBorrowDays: 30,
        maxExtensions: 3,
      }),
    },
    book: { count: jest.fn().mockResolvedValue(5) },
    bookCopy: { count: jest.fn().mockResolvedValue(67) },
    readingList: { count: jest.fn().mockResolvedValue(2) },
    aiMessage: {
      create: jest.fn().mockResolvedValue({}),
    },
    borrow: {
      findMany: jest.fn().mockResolvedValue([
        { bookCopy: { book: { category: 'Computer Science' } } },
        { bookCopy: { book: { category: 'Engineering' } } },
        { bookCopy: { book: { category: 'Computer Science' } } },
      ]),
    },
  };
}

function makeMostBorrowedBooksPrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        name: 'Admin',
        role: Role.ADMIN,
        interests: [],
        courses: [],
        faculty: null,
        borrows: [],
      }),
    },
    borrowPolicy: {
      findUnique: jest.fn().mockResolvedValue({
        maxActiveBorrows: 20,
        maxBorrowDays: 30,
        maxExtensions: 3,
      }),
    },
    book: { count: jest.fn().mockResolvedValue(5) },
    bookCopy: { count: jest.fn().mockResolvedValue(67) },
    readingList: { count: jest.fn().mockResolvedValue(2) },
    aiMessage: {
      create: jest.fn().mockResolvedValue({}),
    },
    borrow: {
      findMany: jest.fn().mockResolvedValue([
        { bookCopy: { book: { title: 'Clean Architecture' } } },
        { bookCopy: { book: { title: 'Design Patterns' } } },
        { bookCopy: { book: { title: 'Clean Architecture' } } },
        { bookCopy: { book: { title: 'Introduction to Algorithms' } } },
        { bookCopy: { book: { title: 'Design Patterns' } } },
      ]),
    },
  };
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
      {} as never,
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

describe('AgentService catalog book content tools', () => {
  it('defines indexed catalog book tools and keeps material tools available', () => {
    const service = makeAgentService();

    const toolNames = service['getTools'](Role.STUDENT).map((tool) => tool.function.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      'search_book_content',
      'get_book_chunk_context',
      'get_book_outline',
      'find_book_structure',
      'search_study_material',
      'get_chunk_context',
      'get_material_outline',
    ]));
  });

  it('executes search_book_content through BookContentSearchService with bounded metadata output', async () => {
    const longContent = `${'Java class methods explain objects. '.repeat(80)}DO_NOT_INCLUDE_TAIL`;
    const bookContentSearch = {
      searchBookChunks: jest.fn().mockResolvedValue([
        {
          bookId: 'book-java',
          title: 'Introduction to Java Programming',
          authors: ['Y. Daniel Liang'],
          chunkId: 'chunk-10',
          chunkIndex: 10,
          pageNumber: 42,
          content: longContent,
          rank: 0.321,
        },
      ]),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'search_book_content',
      { query: 'java class method', bookId: 'book-java', limit: 50 },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(bookContentSearch.searchBookChunks).toHaveBeenCalledWith({
      query: 'java class method',
      bookId: 'book-java',
      limit: 50,
    });
    expect(result.result).toContain('BOOK CONTENT SEARCH RESULTS (query: "java class method")');
    expect(result.result).toContain('[1] Introduction to Java Programming');
    expect(result.result).toContain('Authors: Y. Daniel Liang');
    expect(result.result).toContain('Book ID: book-java');
    expect(result.result).toContain('Chunk: 10');
    expect(result.result).toContain('Page: 42');
    expect(result.result).toContain('Rank: 0.321');
    expect(result.result).not.toContain('DO_NOT_INCLUDE_TAIL');
  });

  it('executes get_book_chunk_context through BookContentSearchService', async () => {
    const bookContentSearch = {
      getBookChunkContext: jest.fn().mockResolvedValue({
        book: {
          id: 'book-java',
          title: 'Introduction to Java Programming',
          authors: ['Y. Daniel Liang'],
        },
        targetChunkIndex: 10,
        chunks: [
          {
            bookId: 'book-java',
            chunkId: 'chunk-9',
            chunkIndex: 9,
            pageNumber: 41,
            content: 'Previous chunk content',
          },
          {
            bookId: 'book-java',
            chunkId: 'chunk-10',
            chunkIndex: 10,
            pageNumber: 42,
            content: 'Current chunk content',
          },
        ],
      }),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'get_book_chunk_context',
      { bookId: 'book-java', chunkIndex: 10, before: 2, after: 2 },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(bookContentSearch.getBookChunkContext).toHaveBeenCalledWith({
      bookId: 'book-java',
      chunkIndex: 10,
      before: 2,
      after: 2,
    });
    expect(result.result).toContain('BOOK CHUNK CONTEXT');
    expect(result.result).toContain('Introduction to Java Programming');
    expect(result.result).toContain('Target chunk: 10');
    expect(result.result).toContain('[Chunk 9, page 41]');
    expect(result.result).toContain('[Chunk 10, page 42]');
  });

  it('executes get_book_outline through BookContentSearchService', async () => {
    const bookContentSearch = {
      getBookOutline: jest.fn().mockResolvedValue({
        book: {
          id: 'book-java',
          title: 'Introduction to Java Programming',
          authors: ['Y. Daniel Liang'],
          pdfIndexStatus: 'INDEXED',
          pdfPageCount: 1344,
          totalChunkCount: 120,
        },
        chunks: [
          {
            bookId: 'book-java',
            chunkId: 'chunk-0',
            chunkIndex: 0,
            pageNumber: 1,
            content: 'Opening indexed content',
          },
        ],
      }),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'get_book_outline',
      { bookId: 'book-java', limit: 20 },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(bookContentSearch.getBookOutline).toHaveBeenCalledWith({
      bookId: 'book-java',
      limit: 20,
    });
    expect(result.result).toContain('BOOK INDEXED OUTLINE');
    expect(result.result).toContain('Introduction to Java Programming');
    expect(result.result).toContain('PDF index status: INDEXED');
    expect(result.result).toContain('PDF pages: 1344');
    expect(result.result).toContain('Total chunks: 120');
    expect(result.result).toContain('This is an opening indexed-content overview, not a guaranteed table of contents.');
  });

  it('explains unavailable indexed outline with book index status', async () => {
    const bookContentSearch = {
      getBookOutline: jest.fn().mockResolvedValue({
        book: {
          id: 'book-pending',
          title: 'Pending Book',
          authors: ['A. Author'],
          pdfIndexStatus: 'PROCESSING',
          pdfPageCount: null,
          totalChunkCount: 0,
        },
        chunks: [],
      }),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'get_book_outline',
      { bookId: 'book-pending' },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(result.result).toContain('BOOK INDEXED OUTLINE');
    expect(result.result).toContain('Pending Book');
    expect(result.result).toContain('PDF index status: PROCESSING');
    expect(result.result).toContain('Total chunks: 0');
    expect(result.result).toContain('indexing has not completed yet');
  });

  it('executes find_book_structure through BookContentSearchService with confidence and warning', async () => {
    const bookContentSearch = {
      findBookStructure: jest.fn().mockResolvedValue({
        book: {
          id: 'book-bjp',
          title: 'Building Java Programs',
          authors: ['Stuart Reges', 'Marty Stepp'],
          pdfIndexStatus: 'INDEXED',
          pdfPageCount: 1234,
          totalChunks: 80,
        },
        confidence: 'partial',
        message: 'Structure evidence is partial unless the evidence clearly shows a full table of contents. Do not claim a final chapter count unless confidence is complete.',
        evidence: [
          {
            chunkId: 'chunk-0',
            chunkIndex: 0,
            pageNumber: 4,
            reason: 'early chunk with contents marker',
            excerpt: 'Brief Contents\n1 Introduction\n2 Primitive Data',
          },
        ],
      }),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'find_book_structure',
      { bookId: 'book-bjp', limit: 25 },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(bookContentSearch.findBookStructure).toHaveBeenCalledWith({
      bookId: 'book-bjp',
      limit: 25,
    });
    expect(result.result).toContain('BOOK STRUCTURE EVIDENCE');
    expect(result.result).toContain('Building Java Programs');
    expect(result.result).toContain('Confidence: partial');
    expect(result.result).toContain('Do not claim a final chapter count unless confidence is complete.');
    expect(result.result).toContain('[Chunk 0, page 4]');
    expect(result.result).toContain('Reason: early chunk with contents marker');
  });

  it('explains missing structure evidence with confidence and index status', async () => {
    const bookContentSearch = {
      findBookStructure: jest.fn().mockResolvedValue({
        book: {
          id: 'book-failed',
          title: 'Failed Book',
          authors: ['A. Author'],
          pdfIndexStatus: 'FAILED',
          pdfPageCount: 12,
          totalChunks: 0,
        },
        confidence: 'unknown',
        message: 'No reliable structure evidence was found. Do not claim a final chapter count unless confidence is complete.',
        evidence: [],
      }),
    };
    const service = makeAgentService({ bookContentSearch });

    const result = await service['executeToolInner'](
      'find_book_structure',
      { bookId: 'book-failed' },
      'user-1',
      Role.STUDENT,
      '',
      {},
    );

    expect(result.result).toContain('BOOK STRUCTURE EVIDENCE');
    expect(result.result).toContain('Failed Book');
    expect(result.result).toContain('PDF index status: FAILED');
    expect(result.result).toContain('Confidence: unknown');
    expect(result.result).toContain('Do not claim a final chapter count unless confidence is complete.');
    expect(result.result).toContain('PDF could not be indexed');
  });
});

describe('AgentService study guide opening prompts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks for a practical book study guide and mentions indexed chunks when available', async () => {
    const prisma = {
      book: {
        findUnique: jest.fn().mockResolvedValue({
          title: 'Introduction to Java Programming',
          authors: ['Y. Daniel Liang'],
          description: 'A Java programming textbook.',
          category: 'Computer Science',
          subjectTags: ['java', 'programming'],
          publicationYear: 2021,
          publisher: 'Pearson',
          pageCount: 1344,
          isEbookAvailable: true,
          _count: { chunks: 128 },
        }),
      },
      aiConversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv-book' }),
      },
      aiMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: '## Study Guide\nGenerated guide' } }],
      }),
    } as never);
    const service = makeAgentService({ prisma });

    await service.createStudySession('user-1', 'book-java');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      messages: Array<{ role: string; content: string }>;
    };
    const prompt = body.messages[0].content;

    expect(prompt).toContain('Quick summary');
    expect(prompt).toContain('Best for');
    expect(prompt).toContain('Difficulty level');
    expect(prompt).toContain('Prerequisites');
    expect(prompt).toContain('Key concepts');
    expect(prompt).toContain('Study roadmap');
    expect(prompt).toContain('Practice tasks');
    expect(prompt).toContain('Quiz questions');
    expect(prompt).toContain('Common mistakes to avoid');
    expect(prompt).toContain('Mastery checklist');
    expect(prompt).toContain('What to ask OZ next');
    expect(prompt).toContain('Indexed chunks available: 128');
    expect(prompt).toContain('Do not invent chapters, page-specific details, or quotes');
  });

  it('asks for a grounded material study guide based on metadata and provided outline chunks', async () => {
    const prisma = {
      material: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mat-1',
          title: 'Java Lecture Notes',
          type: 'COURSE_MATERIAL',
          description: 'Introductory Java notes.',
          authorName: 'Prof. Ada',
          keywords: ['java', 'classes'],
          facultyCode: 'ENG',
          courseCode: 'CS101',
          year: 2026,
        }),
      },
      aiConversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv-material' }),
      },
      aiMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const materialSearch = {
      getAccessContextForUser: jest.fn().mockResolvedValue({
        userId: 'user-1',
        role: Role.STUDENT,
        facultyCode: null,
        courseCodes: [],
      }),
      getMaterialOutline: jest.fn().mockResolvedValue([
        {
          chunkIndex: 0,
          pageNumber: 1,
          content: 'Classes group data and methods in Java.',
        },
      ]),
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: '## Study Guide\nGenerated material guide' } }],
      }),
    } as never);
    const service = makeAgentService({ prisma, materialSearch });

    await service.createMaterialStudySession('user-1', Role.STUDENT, 'mat-1');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      messages: Array<{ role: string; content: string }>;
    };
    const prompt = body.messages[0].content;

    expect(prompt).toContain('Quick summary');
    expect(prompt).toContain('Best for');
    expect(prompt).toContain('Difficulty level');
    expect(prompt).toContain('Prerequisites');
    expect(prompt).toContain('Study roadmap');
    expect(prompt).toContain('Practice tasks');
    expect(prompt).toContain('Quiz questions');
    expect(prompt).toContain('Common mistakes to avoid');
    expect(prompt).toContain('Mastery checklist');
    expect(prompt).toContain('What to ask OZ next');
    expect(prompt).toContain('Base the guide only on the material metadata and outline chunks provided above');
    expect(prompt).toContain('Do not claim to have read chunks that are not provided');
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

describe('AgentService book study sessions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes active indexed book study questions to indexed tools before read_ebook fallback', async () => {
    const prisma = {
      ...makeChatPrisma(Role.STUDENT),
      book: {
        count: jest.fn().mockResolvedValue(5),
        findUnique: jest.fn().mockResolvedValue({
          id: 'book-java',
          title: 'Introduction to Java Programming',
          pdfUrl: '/uploads/pdfs/java.pdf',
          ebookUrl: null,
          pdfIndexStatus: 'INDEXED',
          _count: { chunks: 128 },
        }),
      },
      aiConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-book',
          studyBookId: 'book-java',
          manualModes: [],
          lastAutoModes: [],
          manualModel: null,
          lastResolvedModel: null,
          lastModelSelectionSource: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiMessage: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'assistant',
            content: '## Study Guide: Introduction to Java Programming',
          },
        ]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Use indexed content first.' } }],
        usage: { prompt_tokens: 10, completion_tokens: 7 },
      }),
    } as never);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    for await (const _chunk of service.chatStream(
      'user-1',
      'list the chapters',
      [],
      false,
      null,
      '',
      'conv-book',
    )) {
      // Drain stream.
    }

    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      messages: Array<{ role: string; content: string }>;
      tools?: Array<{ function: { name: string } }>;
    };
    const systemMessage = firstBody.messages.find((entry) => entry.role === 'system')?.content ?? '';

    expect(systemMessage).toContain('Active Book Study Session');
    expect(systemMessage).toContain('Active catalog book ID: `book-java`');
    expect(systemMessage).toContain('PDF index status: INDEXED');
    expect(systemMessage).toContain('Indexed chunks available: 128');
    expect(systemMessage).toContain('use indexed catalog book tools with bookId `book-java` before any URL fallback');
    expect(systemMessage).toContain('Use `find_book_structure` for chapter/table-of-contents questions');
    expect(systemMessage).toContain('Fallback read URL: `/uploads/pdfs/java.pdf`. Use it only when indexed chunks are unavailable or insufficient.');
    expect(systemMessage).toContain('If the user asks about a different book, search the catalog for that book first');
    expect(systemMessage).not.toContain('call `read_ebook` with this URL directly');
    expect(firstBody.tools?.some((tool) => tool.function.name === 'find_book_structure')).toBe(true);
    expect(firstBody.tools?.some((tool) => tool.function.name === 'search_book_content')).toBe(true);
  });
});

describe('AgentService material study sessions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('injects the uploaded material URL so OZ can read the full PDF for page and chapter questions', async () => {
    const prisma = {
      ...makeChatPrisma(Role.STUDENT),
      aiConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-1',
          studyBookId: null,
          manualModes: [],
          lastAutoModes: [],
          manualModel: null,
          lastResolvedModel: null,
          lastModelSelectionSource: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiMessage: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'assistant',
            content: '<!-- oz-material-id: mat-1 -->\n## Study Guide: Introduction to Java',
          },
        ]),
        create: jest.fn().mockResolvedValue({}),
      },
      material: {
        findFirst: jest.fn().mockResolvedValue({
          title: 'Introduction to Java',
          fileUrl: 'https://library-bucket.s3.amazonaws.com/materials/java.pdf',
        }),
      },
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'The material has 1,344 pages.' } }],
        usage: { prompt_tokens: 10, completion_tokens: 7 },
      }),
    } as never);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(1) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'user-1',
      'how many pages in this book?',
      [],
      false,
      null,
      '',
      'conv-1',
    )) {
      chunks.push(chunk);
    }

    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      messages: Array<{ role: string; content: string }>;
      tools: Array<{ function: { name: string; description: string } }>;
    };
    const systemMessage = firstBody.messages.find((entry) => entry.role === 'system')?.content ?? '';
    const readTool = firstBody.tools.find((tool) => tool.function.name === 'read_ebook');

    expect(systemMessage).toContain('Active Material Study Session');
    expect(systemMessage).toContain('The uploaded material read URL is: `https://library-bucket.s3.amazonaws.com/materials/java.pdf`');
    expect(systemMessage).toContain('call `read_ebook` with this URL directly');
    expect(systemMessage).toContain('When listing chapters, preserve or add explicit labels like "Chapter 1:"');
    expect(systemMessage).toContain('one chapter per line');
    expect(readTool?.function.description).toContain('uploaded study-material PDF');
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'text',
      text: 'The material has 1,344 pages.',
    }));
  });

  it('keeps tools enabled for short follow-up requests inside a material study session', async () => {
    const prisma = {
      ...makeChatPrisma(Role.STUDENT),
      aiConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-1',
          studyBookId: null,
          manualModes: [],
          lastAutoModes: [],
          manualModel: null,
          lastResolvedModel: null,
          lastModelSelectionSource: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiMessage: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'assistant',
            content: '<!-- oz-material-id: mat-1 -->\n## Study Guide: Introduction to Java',
          },
          { role: 'user', content: 'how many chapters in this book?' },
          { role: 'assistant', content: 'It has 42 chapters.' },
        ]),
        create: jest.fn().mockResolvedValue({}),
      },
      material: {
        findFirst: jest.fn().mockResolvedValue({
          title: 'Introduction to Java',
          fileUrl: 'https://library-bucket.s3.amazonaws.com/materials/java.pdf',
        }),
      },
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Here are the chapters.' } }],
        usage: { prompt_tokens: 8, completion_tokens: 5 },
      }),
    } as never);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(1) },
    });

    for await (const _chunk of service.chatStream(
      'user-1',
      'list them',
      [],
      false,
      null,
      '',
      'conv-1',
    )) {
      // Drain stream.
    }

    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      tools?: Array<{ function: { name: string } }>;
    };

    expect(firstBody.tools?.some((tool) => tool.function.name === 'read_ebook')).toBe(true);
  });
});

describe('AgentService admin analytics authorization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects admin analytics dashboard requests', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']([
      'Generate an admin analytics dashboard showing:',
      '- Borrowed books by faculty',
      '- Reservations per week',
      '- Overdue books trend',
      '- Fine payments by month',
    ].join('\n'))).toBe(true);
  });

  it('does not treat personal reservation requests as admin analytics', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']('Show my reservations')).toBe(false);
  });

  it('detects most-borrowed category dashboard requests', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']('Show a dashboard graph of most borrowed book categories')).toBe(true);
    expect(service['isMostBorrowedCategoryRequest']('Show a dashboard graph of most borrowed book categories')).toBe(true);
  });

  it('detects most-borrowed book dashboard requests separately from category requests', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']('Show the most borrowed book')).toBe(true);
    expect(service['isMostBorrowedBookRequest']('Show the most borrowed book')).toBe(true);
    expect(service['isMostBorrowedCategoryRequest']('Show the most borrowed book')).toBe(false);
  });

  it('detects system-wide library statistics overview requests as admin analytics', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']('Give me an overview of current library statistics')).toBe(true);
    expect(service['isAdminAnalyticsRequest']('Show current library stats')).toBe(true);
  });

  it('denies student admin analytics requests before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeChatPrisma(Role.STUDENT);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'user-1',
      'Generate an admin analytics dashboard showing borrowed books by faculty and fine payments by month',
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'text',
      text: expect.stringContaining('requires administrator privileges'),
    }));
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'text',
      text: expect.stringContaining('cannot generate admin analytics dashboards'),
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
  });

  it('denies instructor library statistics overview requests before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeChatPrisma(Role.INSTRUCTOR);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'instructor-1',
      'Give me an overview of current library statistics',
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'text',
      text: expect.stringContaining('requires administrator privileges'),
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
  });

  it('denies staff library statistics overview requests before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeChatPrisma(Role.STAFF);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'staff-1',
      'Give me an overview of current library statistics',
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'text',
      text: expect.stringContaining('requires administrator privileges'),
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
  });

  it('returns real admin analytics graph blocks for administrators before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeAdminAnalyticsPrisma();
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(1) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'admin-1',
      [
        'Generate an admin analytics dashboard showing:',
        '- Borrowed books by faculty',
        '- Reservations per week',
        '- Overdue books trend',
        '- Fine payments by month',
      ].join('\n'),
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((chunk): chunk is { type: 'text'; text: string } =>
      typeof chunk === 'object' && chunk !== null && (chunk as { type?: string }).type === 'text',
    );
    const response = textChunks.map((chunk) => chunk.text).join('\n');

    expect(response).toContain('## Admin Analytics Dashboard');
    expect(response.match(/```graph/g)).toHaveLength(4);
    expect(response).toContain('"title": "Borrowed Books by Faculty"');
    expect(response).toContain('"Engineering"');
    expect(response).toContain('20');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.borrow.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.finePayment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
  });

  it('returns a category-specific dashboard instead of the default dashboard', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeMostBorrowedCategoryPrisma();
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(1) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'admin-1',
      'Show a dashboard graph of most borrowed book categories',
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    const response = chunks
      .filter((chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' && chunk !== null && (chunk as { type?: string }).type === 'text',
      )
      .map((chunk) => chunk.text)
      .join('\n');

    expect(response).toContain('## Most Borrowed Book Categories');
    expect(response).toContain('"title": "Most Borrowed Book Categories"');
    expect(response).toContain('"Computer Science"');
    expect(response).not.toContain('Reservations per Week');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.borrow.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns exact most-borrowed book titles and includes ties', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeMostBorrowedBooksPrisma();
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(1) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'admin-1',
      'Show the most borrowed book',
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    const response = chunks
      .filter((chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' && chunk !== null && (chunk as { type?: string }).type === 'text',
      )
      .map((chunk) => chunk.text)
      .join('\n');

    expect(response).toContain('## Most Borrowed Books');
    expect(response).toContain('**Clean Architecture**');
    expect(response).toContain('**Design Patterns**');
    expect(response).toContain('(2 borrows)');
    expect(response).toContain('"title": "Most Borrowed Books"');
    expect(response).toContain('"Clean Architecture"');
    expect(response).toContain('"Design Patterns"');
    expect(response).not.toContain('Reservations per Week');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.borrow.findMany).toHaveBeenCalledTimes(1);
  });

  it('builds a role-specific student denial message', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']('Generate an admin analytics dashboard with fines')).toBe(true);
    expect(service['buildAdminAnalyticsDeniedResponse'](Role.STUDENT)).toContain('student');
  });
});

describe('AgentService literal chart rendering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders user-provided pie chart values as a graph block before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeChatPrisma(Role.STUDENT);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'user-1',
      [
        'Create a pie chart showing library users:',
        'Students = 70%',
        'Instructors = 20%',
        'Staff = 10%',
      ].join('\n'),
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    const response = chunks
      .filter((chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' && chunk !== null && (chunk as { type?: string }).type === 'text',
      )
      .map((chunk) => chunk.text)
      .join('\n');

    expect(response).toContain('```graph');
    expect(response).toContain('"type": "pie"');
    expect(response).toContain('"Students"');
    expect(response).toContain('"Instructors"');
    expect(response).toContain('"Staff"');
    expect(response).toContain('70');
    expect(response).toContain('20');
    expect(response).toContain('10');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
  });

  it('does not classify user-provided borrowed-by-faculty bar chart values as admin analytics', () => {
    const service = makeAgentService();

    expect(service['isAdminAnalyticsRequest']([
      'Create a bar chart comparing borrowed books by faculty:',
      '    Engineering: 42',
      '    Medicine: 35',
      '    Business: 28',
      '    Arts: 18',
      '    Law: 12',
    ].join('\n'))).toBe(false);
  });

  it('renders user-provided borrowed-by-faculty bar chart values for students before calling the model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const prisma = makeChatPrisma(Role.STUDENT);
    const service = makeAgentService({
      prisma,
      materialSearch: { countAccessibleIndexedMaterials: jest.fn().mockResolvedValue(0) },
    });

    const chunks: unknown[] = [];
    for await (const chunk of service.chatStream(
      'user-1',
      [
        'Create a bar chart comparing borrowed books by faculty:',
        '    Engineering: 42',
        '    Medicine: 35',
        '    Business: 28',
        '    Arts: 18',
        '    Law: 12',
      ].join('\n'),
      [],
      false,
      null,
      '',
    )) {
      chunks.push(chunk);
    }

    const response = chunks
      .filter((chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' && chunk !== null && (chunk as { type?: string }).type === 'text',
      )
      .map((chunk) => chunk.text)
      .join('\n');

    expect(response).toContain('```graph');
    expect(response).toContain('"type": "bar"');
    expect(response).toContain('"Engineering"');
    expect(response).toContain('"Medicine"');
    expect(response).toContain('"Law"');
    expect(response).toContain('42');
    expect(response).toContain('35');
    expect(response).toContain('12');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
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
      {} as never,
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
    expect(result.result).toContain('Use the chapter list below directly');
    expect(result.result).toContain('Chapter 1: What Is the Shell?');
    expect(result.result).toContain('Chapter 2: Navigation');
    expect(result.result).toContain('Chapter 4: Manipulating Files and Directories');
    expect(result.result).not.toContain('Chapter 1 What Is the Shell?');
  });

  it('recognizes brief contents and numbered chapter lines without a chapter prefix', async () => {
    const service = makeAgentService();
    const text = [
      'BRIEF CONTENTS',
      '1 Introduction to Computers, Programs, and Java 1',
      '2 Elementary Programming 33',
      '3 Selections 75',
      '33 JavaServer Faces 1213',
      'Chapters 34-42 are bonus Web chapters',
      '34 Advanced JavaFX 34-1',
      '42 Testing Using JUnit 42-1',
      'APPENDIXES',
    ].join('\n');

    const result = service['formatReadableBookContent']({
      title: 'Introduction to Java',
      authors: [],
      description: null,
      category: null,
      publicationYear: null,
      publisher: null,
      pageCount: 1290,
      text,
    }, 'list them');

    expect(result).toContain('BOOK STRUCTURE');
    expect(result).toContain('one chapter per line');
    expect(result).toContain('Chapter 1: Introduction to Computers, Programs, and Java');
    expect(result).toContain('Chapter 34: Advanced JavaFX');
    expect(result).toContain('Chapter 42: Testing Using JUnit');
    expect(result).not.toContain('1 Introduction to Computers, Programs, and Java 1');
  });

  it('formats Clean Code chapter titles as one numbered chapter per line', () => {
    const service = makeAgentService();
    const text = [
      'Contents',
      '1 Clean Code 1',
      '2 Meaningful Names 17',
      '3 Functions 31',
      '4 Comments 53',
      '5 Formatting 75',
      '6 Objects and Data Structures 93',
      '7 Error Handling 103',
      '8 Boundaries 113',
      '9 Unit Tests 121',
      '10 Classes 135',
      '11 Systems 153',
      '12 Emergence 171',
      '13 Concurrency 177',
      '14 Successive Refinement 189',
      '15 JUnit Internals 251',
      '16 Refactoring SerialDate 267',
    ].join('\n');

    const result = service['formatReadableBookContent']({
      title: 'Clean Code',
      authors: [],
      description: null,
      category: null,
      publicationYear: null,
      publisher: null,
      pageCount: 464,
      text,
    }, 'list the chapters');

    expect(result).toContain('Chapter 1: Clean Code');
    expect(result).toContain('Chapter 2: Meaningful Names');
    expect(result).toContain('Chapter 16: Refactoring SerialDate');
    expect(result).not.toContain('Chapter 1: Clean Code Chapter 2: Meaningful Names');
  });
});

