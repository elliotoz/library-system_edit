import { describe, expect, it } from 'vitest';
import { normalizeMathDelimiters } from './ai-markdown-normalizer';

describe('normalizeMathDelimiters', () => {
  it('normalizes escaped inline and display math delimiters', () => {
    const normalized = normalizeMathDelimiters('Use \\(x + 1\\) and \\[x^2\\].');

    expect(normalized).toBe('Use $x + 1$ and $$x^2$$.');
  });

  it('does not mutate fenced graph blocks', () => {
    const markdown = [
      'Before \\(x\\)',
      '```graph',
      '{ "type": "function", "expression": "\\\\(x\\\\)" }',
      '```',
    ].join('\n');

    const normalized = normalizeMathDelimiters(markdown);

    expect(normalized).toContain('Before $x$');
    expect(normalized).toContain('"expression": "\\\\(x\\\\)"');
  });

  it('does not mutate fenced Mermaid blocks', () => {
    const markdown = [
      '```mermaid',
      'graph TD',
      'A[\\(raw\\)] --> B[Done]',
      '```',
    ].join('\n');

    expect(normalizeMathDelimiters(markdown)).toBe(markdown);
  });

  it('does not mutate inline code', () => {
    const markdown = 'Use `\\(x\\)` as literal code, then \\(y\\).';

    expect(normalizeMathDelimiters(markdown)).toBe('Use `\\(x\\)` as literal code, then $y$.');
  });
});
