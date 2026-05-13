import { describe, expect, it } from 'vitest';
import { parseGraphSpec } from './ai-graph-parser';
import { buildGraphTracesForTest } from './ai-graph';

describe('AIGraph trace generation', () => {
  it('builds a Plotly pie trace with labels and values only', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'pie',
      title: 'Library Users',
      labels: ['Students', 'Instructors', 'Staff'],
      values: [70, 20, 10],
    }));

    expect(spec).not.toBeNull();

    const traces = buildGraphTracesForTest(spec!);

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      type: 'pie',
      labels: ['Students', 'Instructors', 'Staff'],
      values: [70, 20, 10],
      name: 'Library Users',
    });
    expect(traces[0]).not.toHaveProperty('x');
    expect(traces[0]).not.toHaveProperty('y');
  });
});
