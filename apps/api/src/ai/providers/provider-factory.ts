import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterProvider } from './openrouter.provider';
import { LlmProvider } from './provider.interface';

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);

  constructor(private readonly openRouterProvider: OpenRouterProvider) {}

  getProvider(model: string): LlmProvider {
    if (!this.openRouterProvider.isAvailable()) {
      throw new Error('OPENROUTER_API_KEY not set — cannot use AI features');
    }
    return this.openRouterProvider;
  }

  getDefaultProvider(): LlmProvider {
    if (!this.openRouterProvider.isAvailable()) {
      throw new Error('OPENROUTER_API_KEY not set — cannot use AI features');
    }
    return this.openRouterProvider;
  }
}
