import { describe, expect, it } from 'vitest';
import { parseGraphSpec } from './ai-graph-parser';
import { buildGraphLayoutForTest, buildGraphTracesForTest } from './ai-graph';

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
      marker: {
        colors: [
          '#14b8a6',
          '#8b5cf6',
          '#f59e0b',
          '#ef4444',
          '#3b82f6',
          '#22c55e',
          '#ec4899',
        ],
      },
      opacity: 1,
    });
    expect(traces[0]).not.toHaveProperty('x');
    expect(traces[0]).not.toHaveProperty('y');
  });

  it('builds a pie layout without cartesian axes and with visible sizing', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'pie',
      title: 'Library Users',
      labels: ['Students', 'Instructors', 'Staff'],
      values: [70, 20, 10],
    }));

    expect(spec).not.toBeNull();

    const layout = buildGraphLayoutForTest(spec!);

    expect(layout).toMatchObject({
      autosize: true,
      height: 360,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      showlegend: true,
    });
    expect(layout.xaxis).toBeUndefined();
    expect(layout.yaxis).toBeUndefined();
  });
});
