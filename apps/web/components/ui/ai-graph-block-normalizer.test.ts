import { describe, expect, it } from 'vitest';
import { normalizeGraphJsonBlocks } from './ai-graph-block-normalizer';

describe('normalizeGraphJsonBlocks', () => {
  it('wraps standalone valid graph JSON in a fenced graph block', () => {
    const normalized = normalizeGraphJsonBlocks([
      'Bar chart:',
      '',
      '{',
      '  "schemaVersion": 1,',
      '  "type": "bar",',
      '  "labels": ["Engineering", "Medicine"],',
      '  "values": [42, 31]',
      '}',
    ].join('\n'));

    expect(normalized).toContain('```graph');
    expect(normalized).toContain('"type": "bar"');
  });

  it('wraps model-style multi-function graph JSON', () => {
    const normalized = normalizeGraphJsonBlocks([
      'Here are both curves:',
      '{',
      '  "schemaVersion": 1,',
      '  "type": "multi-function",',
      '  "functions": [',
      '    { "expression": "x^2", "label": "x^2" },',
      '    { "expression": "2*x+1", "label": "2x+1" }',
      '  ]',
      '}',
    ].join('\n'));

    expect(normalized).toContain('```graph');
    expect(normalized).toContain('"type": "multi-function"');
  });

  it('does not mutate existing fenced graph blocks', () => {
    const markdown = [
      '```graph',
      '{ "type": "function", "expression": "x^2" }',
      '```',
    ].join('\n');

    expect(normalizeGraphJsonBlocks(markdown)).toBe(markdown);
  });

  it('does not wrap non-graph JSON', () => {
    const markdown = 'Example: { "name": "Ada", "role": "student" }';

    expect(normalizeGraphJsonBlocks(markdown)).toBe(markdown);
  });
});
