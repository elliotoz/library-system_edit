import { z } from 'zod';

export const GRAPH_LIMITS = {
  maxPoints: 500,
  maxFunctions: 5,
  maxExpressionLength: 120,
  maxRange: 1000,
  maxLabelLength: 80,
  maxBars: 100,
} as const;

const graphTypeSchema = z.enum([
  'function',
  'scatter',
  'line',
  'bar',
  'pie',
  'multi-function',
  'histogram',
]);

const finiteNumber = z.number().finite();
const label = z.string().max(GRAPH_LIMITS.maxLabelLength);
const expression = z
  .string()
  .trim()
  .min(1)
  .max(GRAPH_LIMITS.maxExpressionLength)
  .refine((value) => !/[;{}[\]]/.test(value), 'Expression contains unsupported characters');

const pointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

const tuplePointSchema = z
  .tuple([finiteNumber, finiteNumber])
  .transform(([x, y]) => ({ x, y }));

const flexiblePointSchema = z.union([pointSchema, tuplePointSchema]);

const graphSeriesSchema = z.object({
  expression: expression.optional(),
  label: label.optional(),
  points: z.array(flexiblePointSchema).max(GRAPH_LIMITS.maxPoints).optional(),
  connectPoints: z.boolean().optional(),
}).strict().refine((series) => series.expression || (series.points && series.points.length > 0), {
  message: 'Graph series needs expression or points',
});

const functionEntrySchema = z.union([
  expression,
  graphSeriesSchema,
]);

const graphSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  type: graphTypeSchema,
  title: label.optional(),
  expression: expression.optional(),
  functions: z.array(functionEntrySchema).max(GRAPH_LIMITS.maxFunctions).optional(),
  xMin: finiteNumber.optional(),
  xMax: finiteNumber.optional(),
  yMin: finiteNumber.optional(),
  yMax: finiteNumber.optional(),
  xLabel: label.optional(),
  yLabel: label.optional(),
  connectPoints: z.boolean().optional(),
  xValues: z.array(finiteNumber).max(GRAPH_LIMITS.maxPoints).optional(),
  yValues: z.array(finiteNumber).max(GRAPH_LIMITS.maxPoints).optional(),
  labels: z.array(label).max(GRAPH_LIMITS.maxBars).optional(),
  points: z.array(flexiblePointSchema).max(GRAPH_LIMITS.maxPoints).optional(),
  values: z.array(finiteNumber).max(GRAPH_LIMITS.maxPoints).optional(),
}).strict().superRefine((spec, ctx) => {
  if (spec.schemaVersion !== undefined && spec.schemaVersion !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Unsupported graph schema version',
      path: ['schemaVersion'],
    });
  }

  validateRange(spec.xMin, spec.xMax, ['xMin'], ctx);
  validateRange(spec.yMin, spec.yMax, ['yMin'], ctx);

  if (spec.xValues && spec.yValues && spec.xValues.length !== spec.yValues.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'xValues and yValues must have the same length',
      path: ['yValues'],
    });
  }

  if (spec.type === 'function' && !spec.expression) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Function graph needs expression' });
  }

  if (spec.type === 'multi-function' && (!spec.functions || spec.functions.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Multi-function graph needs functions' });
  }

  if ((spec.type === 'scatter' || spec.type === 'line') && !spec.points && (!spec.xValues || !spec.yValues)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scatter and line graphs need points or xValues/yValues',
    });
  }

  if (spec.type === 'bar') {
    const values = spec.values ?? spec.yValues;
    if (!spec.labels || !values || spec.labels.length !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bar graphs need labels and values with matching lengths',
      });
    }
  }

  if (spec.type === 'pie') {
    const values = spec.values ?? spec.yValues;
    if (!spec.labels || !values || spec.labels.length !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pie charts need labels and values with matching lengths',
      });
    }
  }

  if (spec.type === 'histogram' && !spec.values && !spec.xValues) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Histogram needs values or xValues' });
  }
});

export type ParsedGraphSpec = z.infer<typeof graphSchema>;

export interface NormalizedGraphSpec {
  schemaVersion: 1;
  type: ParsedGraphSpec['type'];
  title?: string;
  expression?: string;
  functions?: string[];
  series?: Array<{
    expression?: string;
    label?: string;
    points?: Array<{ x: number; y: number }>;
    connectPoints?: boolean;
  }>;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  connectPoints?: boolean;
  xValues?: number[];
  yValues?: number[];
  labels?: string[];
  points?: Array<{ x: number; y: number }>;
  values?: number[];
}

export function parseGraphSpec(raw: string): NormalizedGraphSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Pre-normalise model-generated chart JSON before Zod validation.
  // Models often use non-canonical field names that the schema rejects.
  if (parsed !== null && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;

    // bar + pie: xValues:string[] used as category labels → move to labels
    if (
      (obj.type === 'bar' || obj.type === 'pie') &&
      Array.isArray(obj.xValues) &&
      obj.xValues.every((v: unknown) => typeof v === 'string') &&
      !obj.labels
    ) {
      obj.labels = obj.xValues;
      delete obj.xValues;
    }

    // pie: yValues used instead of values → copy to values
    if (
      obj.type === 'pie' &&
      Array.isArray(obj.yValues) &&
      !obj.values
    ) {
      obj.values = obj.yValues;
      delete obj.yValues;
    }
  }

  const result = graphSchema.safeParse(parsed);
  if (!result.success) return null;

  const spec = result.data;
  return normalizeGraphSpec({
    ...spec,
    schemaVersion: 1,
  });
}

function normalizeGraphSpec(spec: ParsedGraphSpec & { schemaVersion: 1 }): NormalizedGraphSpec {
  const functions = spec.functions
    ?.map((entry) => typeof entry === 'string' ? entry : entry.expression)
    .filter((entry): entry is string => !!entry);

  const series = spec.functions
    ?.filter((entry): entry is Extract<typeof entry, object> => typeof entry === 'object')
    .map((entry) => ({
      expression: entry.expression,
      label: entry.label,
      points: entry.points,
      connectPoints: entry.connectPoints,
    }));

  return {
    ...spec,
    yValues: spec.yValues ?? (spec.type === 'bar' ? spec.values : undefined),
    functions,
    series,
  };
}

function validateRange(
  min: number | undefined,
  max: number | undefined,
  path: Array<string | number>,
  ctx: z.RefinementCtx,
): void {
  if (min === undefined || max === undefined) return;
  if (min >= max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Range min must be less than max', path });
  }
  if (Math.abs(max - min) > GRAPH_LIMITS.maxRange) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Graph range is too large', path });
  }
}
