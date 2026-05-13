'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { evaluate } from 'mathjs';
import { NormalizedGraphSpec, parseGraphSpec } from './ai-graph-parser';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const MAX_SAMPLES = 500;
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

interface AIGraphProps {
  raw: string;
}

export function AIGraph({ raw }: AIGraphProps) {
  const spec = useMemo(() => parseGraphSpec(raw), [raw]);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const traces: Plotly.Data[] = useMemo(() => {
    if (!spec) return [];
    return buildTraces(spec);
  }, [spec]);

  if (!spec || traces.length === 0) {
    return (
      <pre className="bg-gray-100 dark:bg-white/[0.06] rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {raw}
      </pre>
    );
  }

  const hasCartesianAxes = spec.type !== 'pie';
  const isPie = spec.type === 'pie';
  const layout: Partial<Plotly.Layout> = {
    title: spec.title ? { text: spec.title, font: { size: 14 } } : undefined,
    autosize: true,
    height: isPie ? 320 : undefined,
    margin: isPie
      ? { t: spec.title ? 44 : 24, r: 20, b: 64, l: 20 }
      : { t: spec.title ? 40 : 20, r: 20, b: 40, l: 50 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { size: 11, color: dark ? '#e5e7eb' : '#374151' },
    hovermode: hasCartesianAxes ? 'closest' : undefined,
    hoverlabel: {
      bgcolor: dark ? '#111827' : '#ffffff',
      bordercolor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
      font: { color: dark ? '#f9fafb' : '#111827' },
    },
    showlegend: spec.type === 'multi-function' || isPie,
    legend: isPie
      ? { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.15, font: { color: dark ? '#e5e7eb' : '#374151' } }
      : { orientation: 'h', x: 0, y: -0.2, font: { color: dark ? '#e5e7eb' : '#374151' } },
    xaxis: hasCartesianAxes ? {
      title: spec.xLabel ? { text: spec.xLabel } : undefined,
      range: spec.xMin !== undefined && spec.xMax !== undefined ? [spec.xMin, spec.xMax] : undefined,
      gridcolor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      zerolinecolor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    } : undefined,
    yaxis: hasCartesianAxes ? {
      title: spec.yLabel ? { text: spec.yLabel } : undefined,
      range: spec.yMin !== undefined && spec.yMax !== undefined ? [spec.yMin, spec.yMax] : undefined,
      gridcolor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      zerolinecolor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    } : undefined,
  };

  return (
    <div className="my-3 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, displaylogo: false }}
        style={{ width: '100%', minHeight: isPie ? 320 : 260 }}
        useResizeHandler
      />
    </div>
  );
}

function buildTraces(spec: NormalizedGraphSpec): Plotly.Data[] {
  if (spec.type === 'function' && spec.expression) {
    return [buildFunctionTrace(spec.expression, spec.xMin, spec.xMax)];
  }

  if (spec.type === 'multi-function' && spec.functions) {
    return [
      ...spec.functions.map((expr) => buildFunctionTrace(expr, spec.xMin, spec.xMax)),
      ...buildSeriesTraces(spec),
    ];
  }

  if ((spec.type === 'scatter' || spec.type === 'line') && spec.points) {
    return [{
      type: 'scatter',
      mode: getScatterMode(spec),
      x: spec.points.map((point) => point.x),
      y: spec.points.map((point) => point.y),
      name: spec.title ?? spec.type,
    } as Plotly.Data];
  }

  if ((spec.type === 'scatter' || spec.type === 'line') && spec.xValues && spec.yValues) {
    return [{
      type: 'scatter',
      mode: getScatterMode(spec),
      x: spec.xValues,
      y: spec.yValues,
      name: spec.title ?? spec.type,
    } as Plotly.Data];
  }

  if (spec.type === 'bar' && spec.labels && spec.yValues) {
    return [{ type: 'bar', x: spec.labels, y: spec.yValues, name: spec.title ?? 'Values' } as Plotly.Data];
  }

  if (spec.type === 'pie') {
    const pieValues = spec.values ?? spec.yValues;
    if (
      !spec.labels || spec.labels.length === 0 ||
      !pieValues || pieValues.length === 0 ||
      pieValues.length !== spec.labels.length ||
      !pieValues.every((v) => typeof v === 'number' && isFinite(v))
    ) return [];
    return [{
      type: 'pie',
      labels: spec.labels,
      values: pieValues,
      name: spec.title ?? 'Proportion',
      textinfo: 'label+percent',
      hoverinfo: 'label+value+percent',
    } as Plotly.Data];
  }

  if (spec.type === 'histogram') {
    return [{ type: 'histogram', x: spec.values ?? spec.xValues } as Plotly.Data];
  }

  return [];
}

function buildFunctionTrace(expr: string, xMin = -10, xMax = 10): Plotly.Data {
  const { x, y } = sampleFunction(expr, xMin, xMax);
  return { type: 'scatter', mode: 'lines', x, y, name: expr } as Plotly.Data;
}

function buildSeriesTraces(spec: NormalizedGraphSpec): Plotly.Data[] {
  return (spec.series ?? []).flatMap((series) => {
    const traces: Plotly.Data[] = [];
    if (series.expression) {
      traces.push(buildFunctionTrace(series.expression, spec.xMin, spec.xMax));
      traces[traces.length - 1].name = series.label ?? series.expression;
    }
    if (series.points && series.points.length > 0) {
      traces.push({
        type: 'scatter',
        mode: series.connectPoints ? 'lines+markers' : 'markers',
        x: series.points.map((point) => point.x),
        y: series.points.map((point) => point.y),
        name: series.label ?? 'points',
      } as Plotly.Data);
    }
    return traces;
  });
}

function getScatterMode(spec: NormalizedGraphSpec): 'lines' | 'markers' | 'lines+markers' {
  if (spec.type === 'line') return 'lines';
  return spec.connectPoints ? 'lines+markers' : 'markers';
}
