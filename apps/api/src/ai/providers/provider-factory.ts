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
      if (!this.anthropicProvider.isAvailable()) {
        throw new Error('ANTHROPIC_API_KEY not set — cannot use Anthropic models');
      }
      return this.anthropicProvider;
    }
    if (model.startsWith('gemini-') || model.startsWith('google/')) {
      if (!this.geminiProvider.isAvailable()) {
        throw new Error('GEMINI_API_KEY not set — cannot use Gemini models');
      }
      return this.geminiProvider;
    }
    if (!this.groqProvider.isAvailable()) {
      throw new Error(`GROQ_API_KEY not set — cannot use model: ${model}`);
    }
    return this.groqProvider;
  }

  getDefaultProvider(): LlmProvider {
    if (this.anthropicProvider.isAvailable()) {
      return this.anthropicProvider;
    }
    if (this.groqProvider.isAvailable()) {
      return this.groqProvider;
    }
    if (this.geminiProvider.isAvailable()) {
      return this.geminiProvider;
    }
    throw new Error('No LLM provider available — set ANTHROPIC_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY');
  }
}
