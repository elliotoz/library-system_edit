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
      title: 'Library Users',
      autosize: true,
      height: 360,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      showlegend: true,
      legend: {
        orientation: 'h',
      },
    });
    expect(layout.legend).not.toHaveProperty('xanchor');
    expect(layout.legend).not.toHaveProperty('yanchor');
    expect(layout).not.toHaveProperty('hovermode');
    expect(layout).not.toHaveProperty('hoverlabel');
    expect(layout.xaxis).toBeUndefined();
    expect(layout.yaxis).toBeUndefined();
  });

  it('builds semantic per-bar colors for category labels', () => {
    const spec = parseGraphSpec(JSON.stringify({
      schemaVersion: 1,
      type: 'bar',
      title: 'Students per Faculty',
      labels: ['Engineering', 'Medicine', 'Humanities', 'Communication', 'Unknown'],
      values: [42, 31, 18, 24, 7],
    }));

    expect(spec).not.toBeNull();

    const traces = buildGraphTracesForTest(spec!);

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      type: 'bar',
      marker: {
        color: ['#14b8a6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444'],
      },
    });
  });
});
