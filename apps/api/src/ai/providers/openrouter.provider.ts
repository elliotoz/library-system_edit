import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LlmProvider, ProviderMessage, ProviderResponse, ProviderTool } from './provider.interface';
import { getModelByTier } from '../model-registry';

// ── Model tiers ──────────────────────────────────────────────────
// All AI goes through OpenRouter. Pick the cheapest tier that fits the task.
export const OPENROUTER_MODELS = {
  FREE: getModelByTier('free').id,    // $0 — greetings, simple Q&A
  CHEAP: getModelByTier('tool').id,   // ~$0.25/M — tool-calling, catalog queries
  SMART: getModelByTier('smart').id,  // $0.50/M — deep reasoning, complex analysis
  TECHNICAL: getModelByTier('technical').id, // technical, coding, scientific reasoning
  STUDY: getModelByTier('smart').id,  // study sessions — same tier as SMART, structured guides
} as const;

export type ModelTier = keyof typeof OPENROUTER_MODELS;

export interface BookScanResult {
  title?: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
}

/** Return model for a given role — SMART for instructors/admins, FREE otherwise. */
export function modelForRole(role: Role): string {
  if (role === Role.INSTRUCTOR || role === Role.ADMIN) return OPENROUTER_MODELS.SMART;
  return OPENROUTER_MODELS.FREE;
}

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

  private getOpenRouterTimeoutMs(): number {
    const parsed = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 30000);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
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
      signal: AbortSignal.timeout(this.getOpenRouterTimeoutMs()),
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
      signal: AbortSignal.timeout(this.getOpenRouterTimeoutMs()),
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

  async scanBookCover(base64: string): Promise<BookScanResult> {
    if (!this.isAvailable()) return {};

    const visionModel = 'google/gemini-2.0-flash-lite';
    const prompt =
      'Look at this book cover image. Extract the following information and return ONLY a valid JSON object with these exact keys: ' +
      '{"title": "...", "authors": "...", "isbn": "...", "publisher": "...", "publicationYear": 0}. ' +
      'For authors, join multiple authors with a comma. For publicationYear use a 4-digit number or 0 if unknown. ' +
      'If a field is not visible, use an empty string or 0. Return ONLY the JSON, no other text.';

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
              ],
            },
          ],
          max_tokens: 256,
        }),
        signal: AbortSignal.timeout(this.getOpenRouterTimeoutMs()),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`Book cover scan failed: ${res.status} ${err}`);
        return {};
      }

      const data = (await res.json()) as { choices: Array<{ message: { content: string | null } }> };
      const raw = data.choices[0]?.message?.content ?? '';
      return this.parseBookScanResult(raw);
    } catch (err) {
      this.logger.warn(`Book cover scan error: ${String(err)}`);
      return {};
    }
  }

  private parseBookScanResult(raw: string): BookScanResult {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return {};
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const result: BookScanResult = {};
      if (typeof parsed.title === 'string' && parsed.title) result.title = parsed.title;
      if (typeof parsed.authors === 'string' && parsed.authors) result.authors = parsed.authors;
      if (typeof parsed.isbn === 'string' && parsed.isbn) result.isbn = parsed.isbn;
      if (typeof parsed.publisher === 'string' && parsed.publisher) result.publisher = parsed.publisher;
      const year = Number(parsed.publicationYear);
      if (year > 0) result.publicationYear = year;
      return result;
    } catch {
      return {};
    }
  }
}
