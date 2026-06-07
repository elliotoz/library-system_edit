import { Role } from '@prisma/client';
import { buildGraphOutputRule, buildMemoryRuleBlock, buildScientificWorkspaceBlock, buildSystemPrompt, PromptContext } from './system-prompt-builder';

const baseContext: PromptContext = {
  userName: 'Ada',
  userRole: Role.STUDENT,
  userFaculty: 'Engineering',
  userInterests: [],
  activeBorrowsCount: 0,
  currentlyBorrowed: [],
  maxActiveBorrows: 5,
  maxBorrowDays: 14,
  maxExtensions: 2,
  catalogTotalBooks: 100,
  catalogAvailableCopies: 50,
  publishedReadingLists: 3,
  indexedMaterials: 2,
  currentDate: 'Tuesday, 12 May 2026',
};

describe('buildScientificWorkspaceBlock', () => {
  it('returns an empty block when scientific output is not requested', () => {
    expect(buildScientificWorkspaceBlock(false)).toBe('');
  });

  it('documents scientific workspace formatting rules', () => {
    const block = buildScientificWorkspaceBlock(true);

    expect(block).toContain('Scientific Workspace Output');
    expect(block).toContain('Do not claim Python execution support');
    expect(block).toContain('mermaid');
    expect(block).toContain('bmatrix');
  });

  it('does not duplicate graph schema content (moved to buildGraphOutputRule)', () => {
    const block = buildScientificWorkspaceBlock(true);

    expect(block).not.toContain('ALWAYS wrap graph JSON');
    expect(block).not.toContain('Supported types');
  });

  it('documents Python tool usage only when available', () => {
    const block = buildScientificWorkspaceBlock(true, true);

    expect(block).toContain('Use the Python calculation tool');
    expect(block).not.toContain('Do not claim Python execution support');
  });
});

describe('buildGraphOutputRule', () => {
  it('contains strict ALWAYS and NEVER graph formatting rules', () => {
    const block = buildGraphOutputRule();

    expect(block).toContain('ALWAYS wrap graph JSON');
    expect(block).toContain('NEVER output graph JSON');
    expect(block).toContain('NEVER place explanation text inside the graph block');
  });

  it('contains a correct format example with a fenced graph block', () => {
    const block = buildGraphOutputRule();

    expect(block).toContain('Correct format');
    expect(block).toContain('```graph');
  });

  it('contains an invalid format counter-example', () => {
    const block = buildGraphOutputRule();

    expect(block).toContain('Invalid format');
  });

  it('documents all supported graph types', () => {
    const block = buildGraphOutputRule();

    for (const type of ['function', 'multi-function', 'scatter', 'line', 'bar', 'pie', 'histogram']) {
      expect(block).toContain(type);
    }
  });

  it('prohibits inventing library or admin data for charts', () => {
    const block = buildGraphOutputRule();

    expect(block).toContain('Never invent library or admin data');
  });
});

describe('buildMemoryRuleBlock', () => {
  it('contains all required memory boundary rules', () => {
    const block = buildMemoryRuleBlock();

    expect(block).toContain('Conversation Memory');
    expect(block).toContain('conversationId');
    expect(block).toContain('Never mix different conversations');
    expect(block).toContain('Never invent or guess earlier messages');
    expect(block).toContain('recall was truncated');
  });
});

describe('buildSystemPrompt', () => {
  it('includes graph output rule for every prompt regardless of scientificOutput', () => {
    const plain = buildSystemPrompt(baseContext);
    const scientific = buildSystemPrompt({ ...baseContext, scientificOutput: true });

    for (const prompt of [plain, scientific]) {
      expect(prompt).toContain('ALWAYS wrap graph JSON');
      expect(prompt).toContain('NEVER output graph JSON');
    }
  });

  it('includes conversation memory boundary rule in every prompt', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('Conversation Memory');
    expect(prompt).toContain('Never mix different conversations');
  });

  it('makes the student role a practical study tutor', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('explain step by step');
    expect(prompt).toContain('identify prerequisites');
    expect(prompt).toContain('practice tasks');
    expect(prompt).toContain('quiz or checkpoint questions');
    expect(prompt).toContain('mastery checklist');
    expect(prompt).toContain('indexed book content');
    expect(prompt).toContain('practical and not too long');
  });

  it('routes catalog book learning questions to indexed book tools before URL fallback', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('For catalog books, use catalog tools first');
    expect(prompt).toContain('Never ask the user for a URL before checking catalog and indexed book tools');
    expect(prompt).toContain('search_book_content');
    expect(prompt).toContain('get_book_chunk_context');
    expect(prompt).toContain('get_book_outline');
    expect(prompt).toContain('Use material tools only for uploaded academic materials');
    expect(prompt).toContain('If neither indexed chunks nor a readable URL are available');
  });

  it('routes catalog book chapter and table-of-contents questions through indexed structure evidence', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('For catalog book chapter, table of contents, or structure questions');
    expect(prompt).toContain('list chapters');
    expect(prompt).toContain('how many chapters');
    expect(prompt).toContain('chapter by chapter overview');
    expect(prompt).toContain('call find_book_structure');
    expect(prompt).toContain('use get_book_outline only if opening chunks are also needed');
    expect(prompt).toContain('table of contents');
    expect(prompt).toContain('brief contents');
    expect(prompt).toContain('Chapter 1');
    expect(prompt).toContain('Chapter 2');
    expect(prompt).toContain('get_book_chunk_context');
    expect(prompt).toContain('treat retrieved chunks as evidence');
  });

  it('forbids final chapter counts or complete chapter lists from partial indexed evidence', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('Never claim a final chapter count or complete chapter list unless the indexed content clearly provides the full table of contents or full chapter list');
    expect(prompt).toContain('find_book_structure');
    expect(prompt).toContain('I found partial chapter evidence from the indexed content. Here is what I can confirm so far...');
    expect(prompt).toContain('Do not invent missing chapters');
    expect(prompt).toContain('Do not infer a chapter count from scattered chunk matches');
  });

  it('keeps catalog book tools separate from material tools and checks book tools before URL requests', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('Never ask the user for a URL before checking catalog tools, indexed book tools, and any existing readable book URL fallback');
    expect(prompt).toContain('Use catalog and indexed book tools for catalog books');
    expect(prompt).toContain('Use material tools only for uploaded academic materials');
    expect(prompt).toContain('Never use material tools for catalog books');
  });

  it('clarifies casual Java class method questions for students', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('When a student casually says "class methods" in Java');
    expect(prompt).toContain('methods inside classes generally');
    expect(prompt).toContain('static/class methods specifically');
    expect(prompt).toContain('instance methods as the contrast');
  });

  it('instructs the model to read active material PDFs before falling back to indexed outlines', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('uploaded material read URL');
    expect(prompt).toContain('call read_ebook with that URL before answering');
    expect(prompt).toContain('Do not return bare chapter titles');
    expect(prompt).toContain('one chapter per line');
    expect(prompt).toContain('how many chapters or sections it has');
    expect(prompt).toContain('get_material_outline');
    expect(prompt).toContain('NEVER refuse this type of question without first calling the available material tool');
  });

  it('refuses non-admin admin analytics data instead of inventing it', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('Only ADMIN users may receive admin dashboards');
    expect(prompt).toContain('system-wide library statistics/overviews');
    expect(prompt).toContain('For ADMIN users only, to count books');
    expect(prompt).toContain('do not provide full library statistics or overviews');
    expect(prompt).toContain('refuse briefly when the request asks for real/admin operational data');
    expect(prompt).toContain('If the user explicitly provides all chart values');
  });

  it('tells administrators to use the dashboard snapshot tool for operational questions', () => {
    const prompt = buildSystemPrompt({ ...baseContext, userRole: Role.ADMIN });

    expect(prompt).toContain('Use admin dashboard tools for real operational summaries, indexing health, catalog metadata problems, pending actions, and OZ AI usage.');
    expect(prompt).toContain('For a full dashboard overview, use get_admin_dashboard_snapshot.');
    expect(prompt).toContain('For indexing health, failed indexing, zero-chunk books, or RAG readiness, use get_book_indexing_report.');
    expect(prompt).toContain('For missing catalog metadata or catalog quality, use get_catalog_metadata_health.');
    expect(prompt).toContain('For pending reservations, ready pickups, overdue borrows, or other admin actions, use get_library_operations_summary.');
    expect(prompt).toContain('what should I fix first');
    expect(prompt).toContain('If the most specific tool is unavailable or does not cover the request, fall back to get_admin_dashboard_snapshot instead of telling the user the tool is unavailable.');
    expect(prompt).toContain('invent dashboard numbers');
    expect(prompt).toContain('If data is missing, say exactly which backend data is unavailable');
    expect(prompt).toContain('Prefer the admin dashboard snapshot tool when the user asks for overall operational, indexing, or collection health');
  });

  it('preserves library tool rules when scientific output is enabled', () => {
    const prompt = buildSystemPrompt({ ...baseContext, scientificOutput: true });

    expect(prompt).toContain('ALWAYS use a tool to answer library data questions');
    expect(prompt).toContain('Scientific Workspace Output');
  });

  it('omits scientific workspace rules for normal prompts', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).not.toContain('Scientific Workspace Output');
  });
});
