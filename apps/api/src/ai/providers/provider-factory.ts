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
    // All models route through OpenRouter (single API key for everything)
    if (this.openRouterProvider.isAvailable()) {
      return this.openRouterProvider;
    }
    // Fallbacks for edge cases
    if ((model.startsWith('gemini-') || model.startsWith('google/')) && this.geminiProvider.isAvailable()) {
      return this.geminiProvider;
    }
    if (this.groqProvider.isAvailable()) {
      return this.groqProvider;
    }
    throw new Error('OPENROUTER_API_KEY not set — cannot use AI features');
  }

  getDefaultProvider(): LlmProvider {
    if (this.openRouterProvider.isAvailable()) {
      return this.openRouterProvider;
    }
    if (this.groqProvider.isAvailable()) {
      return this.groqProvider;
    }
    if (this.geminiProvider.isAvailable()) {
      return this.geminiProvider;
    }
    throw new Error('No LLM provider available — set OPENROUTER_API_KEY');
  }
}
