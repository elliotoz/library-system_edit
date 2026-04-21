import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { LlmProvider, ProviderMessage, ProviderResponse, ProviderTool } from './provider.interface';

@Injectable()
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqProvider.name);
  private client: Groq | null = null;

  constructor() {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      this.logger.warn('GROQ_API_KEY not set — GroqProvider will be unavailable');
    } else {
      this.client = new Groq({ apiKey: key });
    }
  }

  isAvailable(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  async chat(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
    tools?: ProviderTool[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('GroqProvider: GROQ_API_KEY not set');
    }

    const model = options.model || 'llama-3.3-70b-versatile';

    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: options.system },
      ...options.messages.map((m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const groqTools: Groq.Chat.ChatCompletionTool[] | undefined = options.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));

    const response = await this.client.chat.completions.create({
      model,
      messages: groqMessages,
      tools: groqTools,
      tool_choice: groqTools ? 'auto' : undefined,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    const msg = choice?.message;

    const toolCalls = msg?.tool_calls?.map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
    }));

    return {
      text: msg?.content ?? '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *chatStream(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
  }): AsyncGenerator<{ text: string }> {
    if (!this.client) {
      throw new Error('GroqProvider: GROQ_API_KEY not set');
    }

    const model = options.model || 'llama-3.3-70b-versatile';

    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: options.system },
      ...options.messages.map((m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const stream = await this.client.chat.completions.create({
      model,
      messages: groqMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield { text };
      }
    }
  }
}
