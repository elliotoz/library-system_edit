export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ProviderResponse {
  text: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
}

export interface LlmProvider {
  readonly name: string;
  isAvailable(): boolean; // sync check — just verifies API key is set in env
  chat(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
    tools?: ProviderTool[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<ProviderResponse>;
  chatStream(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
  }): AsyncGenerator<{ text: string }>;
}
