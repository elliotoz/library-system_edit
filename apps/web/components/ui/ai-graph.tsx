'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { evaluate } from 'mathjs';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const MAX_SAMPLES = 500;
const MAX_RANGE = 1000;

interface GraphSpec {
  type: 'function' | 'scatter' | 'line' | 'bar';
  title?: string;
  expression?: string;
  xMin?: number;
  xMax?: number;
  xValues?: number[];
  yValues?: number[];
  labels?: string[];
}

function sampleFunction(expr: string, xMin: number, xMax: number): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const step = (xMax - xMin) / MAX_SAMPLES;
  for (let i = 0; i <= MAX_SAMPLES; i++) {
    const xi = xMin + i * step;
    try {
      const yi = evaluate(expr, { x: xi }) as number;
      if (typeof yi === 'number' && isFinite(yi)) {
        x.push(xi);
        y.push(yi);
      }
    } catch {
      // skip invalid points
    }
  }
  return { x, y };
}

function parseGraphSpec(raw: string): GraphSpec | null {
  try {
    const spec = JSON.parse(raw) as GraphSpec;
    if (!spec.type) return null;
    if (spec.xMin !== undefined && spec.xMax !== undefined) {
      const range = Math.abs(spec.xMax - spec.xMin);
      if (range > MAX_RANGE) return null;
    }
    return spec;
  } catch {
    return null;
  }
}

interface AIGraphProps {
  raw: string;
}

export function AIGraph({ raw }: AIGraphProps) {
  const spec = useMemo(() => parseGraphSpec(raw), [raw]);

  if (!spec) {
    return (
      <pre className="bg-gray-100 dark:bg-white/[0.06] rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {raw}
      </pre>
    );
  }

  const traces: Plotly.Data[] = useMemo(() => {
    if (spec.type === 'function' && spec.expression) {
      const xMin = spec.xMin ?? -10;
      const xMax = spec.xMax ?? 10;
      const { x, y } = sampleFunction(spec.expression, xMin, xMax);
      return [{ type: 'scatter', mode: 'lines', x, y, name: spec.expression } as Plotly.Data];
    }
    if ((spec.type === 'scatter' || spec.type === 'line') && spec.xValues && spec.yValues) {
      return [{
        type: 'scatter',
        mode: spec.type === 'line' ? 'lines' : 'markers',
        x: spec.xValues,
        y: spec.yValues,
      } as Plotly.Data];
    }
    if (spec.type === 'bar' && spec.labels && spec.yValues) {
      return [{ type: 'bar', x: spec.labels, y: spec.yValues } as Plotly.Data];
    }
    return [];
  }, [spec]);

  if (traces.length === 0) {
    return (
      <pre className="bg-gray-100 dark:bg-white/[0.06] rounded p-3 text-xs font-mono overflow-x-auto text-gray-600 dark:text-gray-400">
        {raw}
      </pre>
    );
  }

  const layout: Partial<Plotly.Layout> = {
    title: spec.title ? { text: spec.title, font: { size: 14 } } : undefined,
    autosize: true,
    margin: { t: spec.title ? 40 : 20, r: 20, b: 40, l: 50 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { size: 11 },
  };

  return (
    <div className="my-3 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, displaylogo: false }}
        style={{ width: '100%', minHeight: 260 }}
        useResizeHandler
      />
    </div>
  );
}
