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

  it('refuses non-admin admin analytics data instead of inventing it', () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain('Only ADMIN users may receive admin dashboards');
    expect(prompt).toContain('do not provide sample, placeholder, or invented admin data');
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
