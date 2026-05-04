export const AI_MODE_VALUES = ['learning', 'explanatory', 'planning', 'formal', 'concise'] as const;
export type AiMode = (typeof AI_MODE_VALUES)[number];

export interface AiModeState {
  manualModes: AiMode[];
  lastAutoModes: AiMode[];
  activeModes: AiMode[];
  isStudySession: boolean;
}

export interface AiModeInferenceInput {
  message: string;
  history?: Array<{ role: string; content: string }>;
  isStudySession: boolean;
}

const AI_MODE_SET = new Set<string>(AI_MODE_VALUES);
const MODE_ORDER: ReadonlyArray<AiMode> = AI_MODE_VALUES;
const STUDY_DEFAULT_MODES: ReadonlyArray<AiMode> = ['learning', 'explanatory'];

export function isAiMode(value: unknown): value is AiMode {
  return typeof value === 'string' && AI_MODE_SET.has(value);
}

export function normalizeAiModes(value: unknown): AiMode[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  const normalized = rawValues
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0 && entry !== 'normal' && isAiMode(entry));

  return MODE_ORDER.filter((mode) => normalized.includes(mode));
}

export function getDefaultAutoModes(isStudySession: boolean): AiMode[] {
  return isStudySession ? [...STUDY_DEFAULT_MODES] : [];
}

export function resolveAiModes(manualModes: readonly AiMode[], autoModes: readonly AiMode[]): AiMode[] {
  const unique = new Set<AiMode>([...autoModes, ...manualModes]);
  return MODE_ORDER.filter((mode) => unique.has(mode));
}

export function buildAiModeState(input: {
  manualModes?: unknown;
  lastAutoModes?: unknown;
  isStudySession: boolean;
}): AiModeState {
  const manualModes = normalizeAiModes(input.manualModes);
  const storedAutoModes = normalizeAiModes(input.lastAutoModes);
  const lastAutoModes = storedAutoModes.length > 0 ? storedAutoModes : getDefaultAutoModes(input.isStudySession);
  const activeModes = resolveAiModes(manualModes, lastAutoModes);

  return {
    manualModes,
    lastAutoModes,
    activeModes,
    isStudySession: input.isStudySession,
  };
}

export function inferAutoModes(input: AiModeInferenceInput): AiMode[] {
  const recentHistory = (input.history ?? [])
    .slice(-4)
    .map((item) => item.content)
    .join(' ');
  const message = input.message.toLowerCase();
  const combined = `${recentHistory} ${input.message}`.toLowerCase();
  const detected = new Set<AiMode>(getDefaultAutoModes(input.isStudySession));

  if (/(teach me|help me learn|quiz me|test me|ask me questions|practice questions|study with me|coach me)/i.test(combined)) {
    detected.add('learning');
  }

  if (/(explain|walk me through|break down|step by step|how does|how do|what is|why does|i'?m new|beginner|help me understand|clarify)/i.test(combined)) {
    detected.add('explanatory');
  }

  if (/(plan|roadmap|schedule|timeline|milestone|weekly|daily|study plan|revision plan|prioriti[sz]e|organi[sz]e|prep plan)/i.test(combined)) {
    detected.add('planning');
  }

  if (/(formal|academic tone|professional tone|rewrite formally|polite|report style|essay style|academic style)/i.test(combined)) {
    detected.add('formal');
  }

  if (/(concise|brief|short answer|short version|tldr|bullet points?|keep it short|in a few words|summari[sz]e briefly)/i.test(combined)) {
    detected.add('concise');
  }

  if (detected.size === 0 && /(study session|study guide|learning session)/i.test(message)) {
    detected.add('learning');
    detected.add('explanatory');
  }

  return MODE_ORDER.filter((mode) => detected.has(mode));
}

const MODE_PROMPT_FRAGMENTS: Record<AiMode, string> = {
  learning: '- Learning mode: coach the user actively. Use retrieval questions, light Socratic guidance, and short comprehension checks when it helps learning.',
  explanatory: '- Explanatory mode: break ideas into step-by-step explanations, use concrete examples, and assume the user may be new to the topic.',
  planning: '- Planning mode: structure the answer into phases, milestones, priorities, timelines, or next-step plans whenever relevant.',
  formal: '- Formal mode: use an academic, polished tone with clear headings and precise wording.',
  concise: '- Concise mode: keep the response tight, skip padding, and prefer short bullets or compact sections.',
};

export function buildModeInstructionBlock(activeModes: readonly AiMode[]): string {
  if (activeModes.length === 0) {
    return '';
  }

  return [
    '## Active Response Modes',
    ...MODE_ORDER.filter((mode) => activeModes.includes(mode)).map((mode) => MODE_PROMPT_FRAGMENTS[mode]),
    '',
  ].join('\n');
}
