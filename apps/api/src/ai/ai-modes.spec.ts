import { buildAiModeState, buildModeInstructionBlock, inferAutoModes, normalizeAiModes, resolveAiModes } from './ai-modes';

describe('ai-modes helpers', () => {
  it('normalizes only supported non-normal modes in stable order', () => {
    expect(normalizeAiModes(['formal', 'normal', 'learning', 'invalid', 'formal'])).toEqual(['learning', 'formal']);
  });

  it('infers study defaults plus planning when the prompt asks for a roadmap', () => {
    expect(inferAutoModes({
      message: 'Make me a weekly study roadmap for this book',
      isStudySession: true,
    })).toEqual(['learning', 'explanatory', 'planning']);
  });

  it('adds concise and formal style modes when the user asks for them', () => {
    expect(inferAutoModes({
      message: 'Rewrite this in a formal academic tone and keep it brief',
      isStudySession: false,
    })).toEqual(['formal', 'concise']);
  });

  it('resolves manual and auto modes without duplicates', () => {
    expect(resolveAiModes(['formal', 'concise'], ['learning', 'formal'])).toEqual(['learning', 'formal', 'concise']);
  });

  it('builds study-session mode state with default auto modes', () => {
    expect(buildAiModeState({
      manualModes: ['formal'],
      lastAutoModes: [],
      isStudySession: true,
    })).toEqual({
      manualModes: ['formal'],
      lastAutoModes: ['learning', 'explanatory'],
      activeModes: ['learning', 'explanatory', 'formal'],
      isStudySession: true,
    });
  });

  it('builds a composable instruction block for active modes', () => {
    const block = buildModeInstructionBlock(['learning', 'concise']);
    expect(block).toContain('## Active Response Modes');
    expect(block).toContain('Learning mode');
    expect(block).toContain('Concise mode');
  });

  it('describes the richer tutor pattern for learning, explanatory, and planning modes', () => {
    const block = buildModeInstructionBlock(['learning', 'explanatory', 'planning']);

    expect(block).toContain('Simple explanation');
    expect(block).toContain('Practice task');
    expect(block).toContain('Checkpoint question');
    expect(block).toContain('define terms before using them');
    expect(block).toContain('roadmaps, study schedules, milestones, or daily tasks');
    expect(block).toContain('next action');
  });
});
