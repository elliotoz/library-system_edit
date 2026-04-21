import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LlmProvider, ProviderMessage, ProviderResponse, ProviderTool } from './provider.interface';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic | null = null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      this.logger.warn('ANTHROPIC_API_KEY not set — AnthropicProvider will be unavailable');
    } else {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
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
      throw new Error('AnthropicProvider: ANTHROPIC_API_KEY not set');
    }

    const model = options.model ?? 'claude-haiku-4-5-20251001';

    const anthropicMessages: Anthropic.MessageParam[] = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const anthropicTools: Anthropic.Tool[] | undefined = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));

    const response = await this.client.messages.create({
      model,
      system: options.system,
      messages: anthropicMessages,
      tools: anthropicTools,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 4096,
    });

    // Extract text and tool_use blocks
    let text = '';
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: (response.usage as unknown as Record<string, number>).cache_creation_input_tokens,
        cacheReadTokens: (response.usage as unknown as Record<string, number>).cache_read_input_tokens,
      },
    };
  }

  async *chatStream(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
  }): AsyncGenerator<{ text: string }> {
    if (!this.client) {
      throw new Error('AnthropicProvider: ANTHROPIC_API_KEY not set');
    }

    const model = options.model ?? 'claude-haiku-4-5-20251001';

    const anthropicMessages: Anthropic.MessageParam[] = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = await this.client.messages.stream({
      model,
      system: options.system,
      messages: anthropicMessages,
      max_tokens: 4096,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { text: event.delta.text };
      }
    }
  }
}
