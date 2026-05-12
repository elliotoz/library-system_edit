import { Role } from '@prisma/client';
import { buildScientificWorkspaceBlock, buildSystemPrompt, PromptContext } from './system-prompt-builder';

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

  it('documents currently supported renderer features', () => {
    const block = buildScientificWorkspaceBlock(true);

    expect(block).toContain('Scientific Workspace Output');
    expect(block).toContain('multi-function');
    expect(block).toContain('points');
    expect(block).toContain('Do not claim Python execution support');
  });

  it('documents Python tool usage only when available', () => {
    const block = buildScientificWorkspaceBlock(true, true);

    expect(block).toContain('Use the Python calculation tool');
    expect(block).not.toContain('Do not claim Python execution support');
  });
});

describe('buildSystemPrompt', () => {
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
