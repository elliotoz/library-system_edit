import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OPENROUTER_MODELS } from './providers/openrouter.provider';

export interface BookScanResult {
  title?: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
}

@Injectable()
export class GroqService implements OnModuleInit {
  private readonly logger = new Logger(GroqService.name);
  private available = false;
  private readonly openRouterBaseUrl = 'https://openrouter.ai/api/v1';

  readonly defaultModel = OPENROUTER_MODELS.FREE;

  onModuleInit() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      this.logger.warn('OPENROUTER_API_KEY not set — AI chat will fall back to rule-based responses');
      return;
    }
    this.available = true;
    this.logger.log('✅ OpenRouter API initialized (using OPENROUTER_API_KEY only)');
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModel(role: Role, queryType?: 'deep-reasoning' | 'simple'): string {
    if (queryType === 'deep-reasoning') return OPENROUTER_MODELS.SMART;
    return OPENROUTER_MODELS.FREE;
  }

  private get openRouterHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'X-Title': 'LibrarySystem',
    };
  }

  /** Call OpenRouter with automatic 429 fallback from FREE → CHEAP tier. */
  private async callOpenRouter(
    model: string,
    messages: { role: string; content: string }[],
  ): Promise<{ content: string; modelUsed: string }> {
    let orModel = model.includes('/') ? model : OPENROUTER_MODELS.FREE;
    this.logger.debug(`OpenRouter — model: ${orModel}`);

    const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.openRouterHeaders,
      body: JSON.stringify({ model: orModel, messages, max_tokens: 1024 }),
    });

    if (!res.ok) {
      // Auto-fallback on free tier rate limit
      if (res.status === 429 && orModel === OPENROUTER_MODELS.FREE) {
        this.logger.warn(`Free tier rate-limited, falling back to CHEAP tier`);
        orModel = OPENROUTER_MODELS.CHEAP;
        const retry = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.openRouterHeaders,
          body: JSON.stringify({ model: orModel, messages, max_tokens: 1024 }),
        });
        if (!retry.ok) {
          const err = await retry.text();
          throw new Error(`OpenRouter API error ${retry.status}: ${err}`);
        }
        const data = await retry.json() as { choices: Array<{ message: { content: string | null } }> };
        return { content: data.choices[0]?.message?.content ?? '', modelUsed: orModel };
      }
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string | null } }> };
    return { content: data.choices[0]?.message?.content ?? '', modelUsed: orModel };
  }

  async generate(model: string, prompt: string, system?: string): Promise<{ response: string }> {
    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const { content } = await this.callOpenRouter(model, messages);
    return { response: content };
  }

  async chat(
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<{ message: { content: string } }> {
    const { content } = await this.callOpenRouter(model, messages);
    return { message: { content } };
  }

  async scanBookCover(base64: string): Promise<BookScanResult> {
    if (!this.available) {
      this.logger.warn('OpenRouter API not available — cannot scan book cover');
      return {};
    }

    const visionModel = 'google/gemini-2.0-flash-lite';
    const prompt =
      'Look at this book cover image. Extract the following information and return ONLY a valid JSON object with these exact keys: ' +
      '{"title": "...", "authors": "...", "isbn": "...", "publisher": "...", "publicationYear": 0}. ' +
      'For authors, join multiple authors with a comma. For publicationYear use a 4-digit number or 0 if unknown. ' +
      'If a field is not visible, use an empty string or 0. Return ONLY the JSON, no other text.';

    try {
      const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
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
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`Book cover scan failed: ${res.status} ${err}`);
        return {};
      }

      const data = await res.json() as { choices: Array<{ message: { content: string | null } }> };
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
