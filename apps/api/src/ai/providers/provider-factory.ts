import { Injectable } from '@nestjs/common';
import { GroqProvider } from './groq.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { LlmProvider } from './provider.interface';

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly groqProvider: GroqProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openRouterProvider: OpenRouterProvider,
  ) {}

  getProvider(model: string): LlmProvider {
    if (model.startsWith('claude-') || model.startsWith('anthropic/')) {
      if (!this.openRouterProvider.isAvailable()) {
        throw new Error('OPENROUTER_API_KEY not set — cannot use Claude models via OpenRouter');
      }
      return this.openRouterProvider;
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
    if (this.groqProvider.isAvailable()) {
      return this.groqProvider;
    }
    if (this.openRouterProvider.isAvailable()) {
      return this.openRouterProvider;
    }
    if (this.geminiProvider.isAvailable()) {
      return this.geminiProvider;
    }
    throw new Error('No LLM provider available — set GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY');
  }
}
