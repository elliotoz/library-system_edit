import { Injectable } from '@nestjs/common';
import { GroqProvider } from './groq.provider';
import { GeminiProvider } from './gemini.provider';
import { AnthropicProvider } from './anthropic.provider';
import { LlmProvider } from './provider.interface';

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly groqProvider: GroqProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly anthropicProvider: AnthropicProvider,
  ) {}

  getProvider(model: string): LlmProvider {
    if (model.startsWith('claude-') || model.startsWith('anthropic/')) {
      return this.anthropicProvider;
    }
    if (model.startsWith('gemini-') || model.startsWith('google/')) {
      return this.geminiProvider;
    }
    return this.groqProvider;
  }

  getDefaultProvider(): LlmProvider {
    if (process.env.ANTHROPIC_API_KEY) {
      return this.anthropicProvider;
    }
    if (process.env.GROQ_API_KEY) {
      return this.groqProvider;
    }
    if (process.env.GEMINI_API_KEY) {
      return this.geminiProvider;
    }
    throw new Error('No LLM provider available — set ANTHROPIC_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY');
  }
}
