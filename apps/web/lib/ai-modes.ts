export const AI_MODE_VALUES = ['learning', 'explanatory', 'planning', 'formal', 'concise'] as const;
export type AiMode = (typeof AI_MODE_VALUES)[number];
export type DisplayAiMode = AiMode | 'normal';

const MODE_ORDER: ReadonlyArray<AiMode> = AI_MODE_VALUES;

export function normalizeAiModes(value: unknown): AiMode[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  const normalized = rawValues
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is AiMode => MODE_ORDER.includes(entry as AiMode));

  return MODE_ORDER.filter((mode) => normalized.includes(mode));
}

export function resolveAiModes(manualModes: readonly AiMode[], autoModes: readonly AiMode[]): AiMode[] {
  const active = new Set<AiMode>([...autoModes, ...manualModes]);
  return MODE_ORDER.filter((mode) => active.has(mode));
}
