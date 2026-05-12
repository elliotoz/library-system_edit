import { z } from 'zod';

export const GRAPH_LIMITS = {
  maxPoints: 1000,
  maxFunctions: 4,
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

const graphSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  type: graphTypeSchema,
  title: label.optional(),
  expression: expression.optional(),
  functions: z.array(expression).max(GRAPH_LIMITS.maxFunctions).optional(),
  xMin: finiteNumber.optional(),
  xMax: finiteNumber.optional(),
  yMin: finiteNumber.optional(),
  yMax: finiteNumber.optional(),
  xLabel: label.optional(),
  yLabel: label.optional(),
  xValues: z.array(finiteNumber).max(GRAPH_LIMITS.maxPoints).optional(),
  yValues: z.array(finiteNumber).max(GRAPH_LIMITS.maxPoints).optional(),
  labels: z.array(label).max(GRAPH_LIMITS.maxBars).optional(),
  points: z.array(pointSchema).max(GRAPH_LIMITS.maxPoints).optional(),
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

  if (spec.type === 'bar' && (!spec.labels || !spec.yValues || spec.labels.length !== spec.yValues.length)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bar graphs need labels and yValues with matching lengths',
    });
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
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
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

  const result = graphSchema.safeParse(parsed);
  if (!result.success) return null;

  const spec = result.data;
  return {
    ...spec,
    schemaVersion: 1,
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
