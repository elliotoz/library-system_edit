'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { evaluate } from 'mathjs';
import { NormalizedGraphSpec, parseGraphSpec } from './ai-graph-parser';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const MAX_SAMPLES = 500;
const PIE_MARKER_COLORS = [
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#ec4899',
];
const PLOTLY_CONFIG: Partial<Plotly.Config> = { responsive: true, displayModeBar: true, displaylogo: false };

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
  const [renderError, setRenderError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphDivRef = useRef<HTMLElement | null>(null);

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

  const isPie = spec?.type === 'pie';
  const layout: Partial<Plotly.Layout> | null = useMemo(() => {
    if (!spec) return null;
    return buildLayout(spec, dark);
  }, [dark, spec]);

  useEffect(() => {
    if (!spec || !layout) return;
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && !window.localStorage.getItem('oz-ai-graph-debug')) {
      return;
    }

    console.debug('[OZ AIGraph]', {
      raw,
      parsedGraphSpec: parseGraphSpec(raw),
      normalizedGraphSpec: spec,
      plotlyDataTraces: traces,
      plotlyLayout: layout,
      plotlyConfig: PLOTLY_CONFIG,
    });
  }, [layout, raw, spec, traces]);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (graphDivRef.current) resizePlot(graphDivRef.current);
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  if (!spec || traces.length === 0) {
    return (
      <div className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="mb-2 font-semibold">Graph could not render.</p>
        <p className="mb-2">{spec ? 'No valid Plotly traces were generated.' : 'Graph JSON did not pass validation.'}</p>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-amber-900 dark:text-amber-100">
          {raw}
        </pre>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="mb-2 font-semibold">Graph could not render.</p>
        <p>{renderError}</p>
      </div>
    );
  }

  const plotLayout = layout ?? {};

  return (
    <div ref={containerRef} className="my-3 min-h-[320px] rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      <Plot
        data={traces}
        layout={plotLayout}
        config={PLOTLY_CONFIG}
        style={{ width: '100%', height: isPie ? 360 : 320, minHeight: isPie ? 360 : 260 }}
        useResizeHandler
        onInitialized={(_, graphDiv) => {
          graphDivRef.current = graphDiv;
          resizePlot(graphDiv);
        }}
        onUpdate={(_, graphDiv) => {
          graphDivRef.current = graphDiv;
          resizePlot(graphDiv);
        }}
        onError={(error) => setRenderError(error.message)}
      />
    </div>
  );
}

function buildLayout(spec: NormalizedGraphSpec, dark: boolean): Partial<Plotly.Layout> {
  if (spec.type === 'pie') {
    return buildPieLayout(spec, dark);
  }

  return {
    title: spec.title ? { text: spec.title } : undefined,
    autosize: true,
    width: undefined,
    margin: { t: spec.title ? 40 : 20, r: 20, b: 40, l: 50 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { size: 11, color: dark ? '#e5e7eb' : '#374151' },
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: dark ? '#111827' : '#ffffff',
      bordercolor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
      font: { color: dark ? '#f9fafb' : '#111827' },
    },
    showlegend: spec.type === 'multi-function',
    legend: { orientation: 'h', x: 0, y: -0.2, font: { color: dark ? '#e5e7eb' : '#374151' } },
    xaxis: {
      title: spec.xLabel ? { text: spec.xLabel } : undefined,
      range: spec.xMin !== undefined && spec.xMax !== undefined ? [spec.xMin, spec.xMax] : undefined,
      gridcolor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      zerolinecolor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    },
    yaxis: {
      title: spec.yLabel ? { text: spec.yLabel } : undefined,
      range: spec.yMin !== undefined && spec.yMax !== undefined ? [spec.yMin, spec.yMax] : undefined,
      gridcolor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      zerolinecolor: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    },
  };
}

function buildPieLayout(spec: NormalizedGraphSpec, dark: boolean): Partial<Plotly.Layout> {
  return {
    title: spec.title as unknown as Plotly.Layout['title'],
    autosize: true,
    height: 360,
    margin: { t: spec.title ? 48 : 24, r: 24, b: 72, l: 24 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: dark ? '#e5e7eb' : '#374151' },
    showlegend: true,
    legend: { orientation: 'h' },
  };
}

function resizePlot(_graphDiv: Readonly<HTMLElement>): void {
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

export function buildGraphTracesForTest(spec: NormalizedGraphSpec): Plotly.Data[] {
  return buildTraces(spec);
}

export function buildGraphLayoutForTest(spec: NormalizedGraphSpec, dark = false): Partial<Plotly.Layout> {
  return buildLayout(spec, dark);
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
    const pieValues = spec.values;
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
      marker: { colors: PIE_MARKER_COLORS },
      opacity: 1,
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
