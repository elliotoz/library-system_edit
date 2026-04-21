import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LlmProvider, ProviderMessage, ProviderResponse, ProviderTool } from './provider.interface';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      this.logger.warn('GEMINI_API_KEY not set — GeminiProvider will be unavailable');
    } else {
      this.client = new GoogleGenerativeAI(key);
    }
  }

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
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
      throw new Error('GeminiProvider: GEMINI_API_KEY not set');
    }

    const modelName = options.model || 'gemini-1.5-flash';

    const genModel = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: options.system,
    });

    // Build history (all but the last message) and extract the last user message
    const allMessages = options.messages;
    const lastMessage = allMessages[allMessages.length - 1];
    const history = allMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = genModel.startChat({
      history,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    });

    const result = await chat.sendMessage(lastMessage?.content ?? '');
    const text = result.response.text();

    return {
      text,
      toolCalls: undefined, // Gemini tool support not implemented in free tier
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  }

  async *chatStream(options: {
    model: string;
    system: string;
    messages: ProviderMessage[];
  }): AsyncGenerator<{ text: string }> {
    if (!this.client) {
      throw new Error('GeminiProvider: GEMINI_API_KEY not set');
    }

    const modelName = options.model || 'gemini-1.5-flash';

    const genModel = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: options.system,
    });

    const allMessages = options.messages;
    const lastMessage = allMessages[allMessages.length - 1];
    const history = allMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage?.content ?? '');

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { text };
      }
    }
  }
}
