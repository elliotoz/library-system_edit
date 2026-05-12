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

  it('accepts connected scatter graphs', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'scatter',
      points: [{ x: 1, y: 2 }, { x: 2, y: 3 }],
      connectPoints: true,
    }));

    expect(spec?.type).toBe('scatter');
    expect(spec?.connectPoints).toBe(true);
  });

  it('accepts multi-function graphs within limits', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'multi-function',
      functions: ['x^2', '2*x + 1', 'x^3', 'sqrt(x)', 'sin(x)'],
      xMin: -5,
      xMax: 5,
    }));

    expect(spec?.type).toBe('multi-function');
    expect(spec?.functions).toHaveLength(GRAPH_LIMITS.maxFunctions);
  });

  it('accepts line graphs with legacy xValues and yValues', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'line',
      xValues: [1, 2, 3],
      yValues: [3, 4, 5],
    }));

    expect(spec?.type).toBe('line');
    expect(spec?.xValues).toEqual([1, 2, 3]);
  });

  it('accepts bar charts with labels and yValues', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'bar',
      labels: ['Engineering', 'Science'],
      yValues: [8, 5],
    }));

    expect(spec?.type).toBe('bar');
    expect(spec?.labels).toEqual(['Engineering', 'Science']);
  });

  it('accepts pie charts with labels and values', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'pie',
      labels: ['Students', 'Staff'],
      values: [80, 20],
    }));

    expect(spec?.type).toBe('pie');
    expect(spec?.values).toEqual([80, 20]);
  });

  it('accepts pie charts with labels and legacy yValues', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'pie',
      labels: ['Available', 'Borrowed'],
      yValues: [60, 40],
    }));

    expect(spec?.type).toBe('pie');
    expect(spec?.yValues).toEqual([60, 40]);
  });

  it('rejects oversized point arrays', () => {
    const points = Array.from({ length: GRAPH_LIMITS.maxPoints + 1 }, (_, x) => ({ x, y: x }));
    const spec = parseGraphSpec(JSON.stringify({ type: 'scatter', points }));

    expect(spec).toBeNull();
  });

  it('rejects oversized function arrays', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'multi-function',
      functions: Array.from({ length: GRAPH_LIMITS.maxFunctions + 1 }, (_, i) => `x+${i}`),
    }));

    expect(spec).toBeNull();
  });

  it('rejects mismatched xValues and yValues', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'scatter',
      xValues: [1, 2],
      yValues: [1],
    }));

    expect(spec).toBeNull();
  });

  it('rejects incomplete pie charts', () => {
    const spec = parseGraphSpec(JSON.stringify({
      type: 'pie',
      labels: ['A', 'B'],
    }));

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
