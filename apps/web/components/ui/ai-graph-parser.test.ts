import { describe, expect, it } from 'vitest';
import { GRAPH_LIMITS, parseGraphSpec } from './ai-graph-parser';

describe('parseGraphSpec', () => {
  it('accepts the existing function graph schema', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'function',
      title: 'Quadratic',
      expression: 'x^2',
      xMin: -10,
      xMax: 10,
    }));

    expect(spec?.type).toBe('function');
    expect(spec?.schemaVersion).toBe(1);
  });

  it('accepts schemaVersion 1 scatter points', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'scatter',
      points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      xLabel: 'x',
      yLabel: 'y',
    }));

    expect(spec?.points).toHaveLength(2);
    expect(spec?.xLabel).toBe('x');
  });

  it('accepts multi-function graphs within limits', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'multi-function',
      functions: ['x^2', '2*x + 1'],
      xMin: -5,
      xMax: 5,
    }));

    expect(spec?.type).toBe('multi-function');
    expect(spec?.functions).toEqual(['x^2', '2*x + 1']);
  });

  it('rejects oversized point arrays', () => {
    const points = Array.from({ length: GRAPH_LIMITS.maxPoints + 1 }, (_, x) => ({ x, y: x }));
    const spec = parseGraphSpec(JSON.stringify({ type: 'scatter', points }));

    expect(spec).toBeNull();
  });

  it('rejects oversized ranges', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'function',
      expression: 'x',
      xMin: -1000,
      xMax: 1000,
    }));

    expect(spec).toBeNull();
  });

  it('rejects long expressions', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'function',
      expression: 'x'.repeat(GRAPH_LIMITS.maxExpressionLength + 1),
    }));

    expect(spec).toBeNull();
  });

  it('rejects invalid JSON', () => {
    expect(parseGraphSpec('{')).toBeNull();
  });
});
