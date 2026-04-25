import { Injectable, Logger } from '@nestjs/common';
import { LlmProvider, ProviderMessage, ProviderResponse, ProviderTool } from './provider.interface';

// ── Model tiers ──────────────────────────────────────────────────
// All AI goes through OpenRouter. Pick the cheapest tier that fits the task.
export const OPENROUTER_MODELS = {
  FREE: 'google/gemma-4-31b-it:free',                // $0 — greetings, simple Q&A
  CHEAP: 'google/gemini-3.1-flash-lite-preview',                   // ~$0.25/M — tool-calling, catalog queries
  SMART: 'anthropic/claude-3-haiku',                 // $0.50/M — deep reasoning, complex analysis
} as const;

export type ModelTier = keyof typeof OPENROUTER_MODELS;

interface OpenRouterChatResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface OpenRouterStreamChunk {
  choices: Array<{
    delta?: { content?: string };
  }>;
}

@Injectable()
export class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter';
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    if (!process.env.OPENROUTER_API_KEY) {
      this.logger.warn('OPENROUTER_API_KEY not set — OpenRouterProvider will be unavailable');
    }
  }

  isAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'X-Title': 'LibrarySystem',
    };
  }

  async chat(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
    tools?: ProviderTool[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<ProviderResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenRouterProvider: OPENROUTER_API_KEY not set');
    }

    const messages = [
      { role: 'system', content: options.system },
      ...options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 4096,
    };

    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as OpenRouterChatResponse;
    const choice = data.choices[0];
    const text = choice.message.content ?? '';

    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
  }

  async *chatStream(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
  }): AsyncGenerator<{ text: string }> {
    if (!this.isAvailable()) {
      throw new Error('OpenRouterProvider: OPENROUTER_API_KEY not set');
    }

    const messages = [
      { role: 'system', content: options.system },
      ...options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter stream error ${res.status}: ${err}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const json = trimmed.slice(6);
          if (json === '[DONE]') return;

          try {
            const chunk = JSON.parse(json) as OpenRouterStreamChunk;
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield { text: content };
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
