export const AUTO_MODEL_ID = 'auto';

export interface AiModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: AUTO_MODEL_ID,
    name: 'Auto',
    description: 'OZ chooses the best model for each request',
    badge: 'Default',
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini Flash Lite',
    description: 'Fast · catalog queries & tool use',
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Smart · deep analysis & research',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 (Free)',
    description: 'Free · simple questions & greetings',
    badge: 'Free',
  },
];

export function getAiModelOption(modelId?: string | null): AiModelOption | undefined {
  return AI_MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function getAiModelLabel(modelId?: string | null): string {
  return getAiModelOption(modelId)?.name ?? (modelId || 'Unknown model');
}
