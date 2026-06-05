export const AUTO_MODEL_ID = 'auto';

export interface AiModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface BackendAiModelOption {
  id: string;
  label: string;
  description: string;
  badge?: string;
}

export const AUTO_MODEL_OPTION: AiModelOption = {
  id: AUTO_MODEL_ID,
  name: 'Auto',
  description: 'OZ chooses the best model for each request',
  badge: 'Default',
};

export const AUTO_ONLY_MODEL_OPTIONS: AiModelOption[] = [AUTO_MODEL_OPTION];

export function mapBackendModelOption(model: BackendAiModelOption): AiModelOption {
  return {
    id: model.id,
    name: model.label,
    description: model.description,
    ...(model.badge ? { badge: model.badge } : {}),
  };
}

export function mapBackendModelOptions(models: BackendAiModelOption[]): AiModelOption[] {
  const mapped = models
    .filter((model) => model.id && model.label && model.description)
    .map(mapBackendModelOption);

  return mapped.length > 0 ? mapped : AUTO_ONLY_MODEL_OPTIONS;
}

export function getAiModelOption(modelId?: string | null, models: AiModelOption[] = AUTO_ONLY_MODEL_OPTIONS): AiModelOption | undefined {
  return models.find((model) => model.id === modelId);
}

export function getAiModelLabel(modelId?: string | null, models: AiModelOption[] = AUTO_ONLY_MODEL_OPTIONS): string {
  return getAiModelOption(modelId, models)?.name ?? (modelId || 'Unknown model');
}
