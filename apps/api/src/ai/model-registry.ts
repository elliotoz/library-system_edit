export const AUTO_MODEL_ID = 'auto';

export interface ModelCapabilities {
  supportsImages: boolean;
  supportsTools: boolean;
}

export interface ModelRegistryEntry {
  id: string;
  label: string;
  description: string;
  tier: 'free' | 'tool' | 'smart';
  capabilities: ModelCapabilities;
  isSelectable: boolean;
}

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 (Free)',
    description: 'Free · simple questions & greetings',
    tier: 'free',
    capabilities: { supportsImages: false, supportsTools: false },
    isSelectable: true,
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    label: 'Gemini Flash Lite',
    description: 'Fast · catalog queries & tool use',
    tier: 'tool',
    capabilities: { supportsImages: true, supportsTools: true },
    isSelectable: true,
  },
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku',
    description: 'Smart · deep analysis & research',
    tier: 'smart',
    capabilities: { supportsImages: true, supportsTools: true },
    isSelectable: true,
  },
];

export const SELECTABLE_MODEL_IDS: string[] = MODEL_REGISTRY
  .filter((m) => m.isSelectable)
  .map((m) => m.id);

export function getModelEntry(id: string): ModelRegistryEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function isAllowlistedModel(id: string): boolean {
  return id === AUTO_MODEL_ID || SELECTABLE_MODEL_IDS.includes(id);
}

export function getModelByTier(tier: ModelRegistryEntry['tier']): ModelRegistryEntry {
  const entry = MODEL_REGISTRY.find((m) => m.tier === tier);
  if (!entry) throw new Error(`No model registered for tier: ${tier}`);
  return entry;
}

/** Returns frontend-safe model metadata (no internals). */
export function getPublicModelList(): Array<{ id: string; label: string; description: string; badge?: string }> {
  const auto = { id: AUTO_MODEL_ID, label: 'Auto', description: 'OZ chooses the best model for each request', badge: 'Default' };
  const models = MODEL_REGISTRY
    .filter((m) => m.isSelectable)
    .map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      ...(m.tier === 'free' ? { badge: 'Free' } : {}),
    }));
  return [auto, ...models];
}
