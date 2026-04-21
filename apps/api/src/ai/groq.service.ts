import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Role } from '@prisma/client';

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
  private client: Groq;
  private gemini: GoogleGenerativeAI | null = null;
  private available = false;

  readonly defaultModel = 'llama-3.3-70b-versatile';
  readonly visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

  onModuleInit() {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      this.logger.warn('GROQ_API_KEY not set — AI chat will fall back to rule-based responses');
      return;
    }
    this.client = new Groq({ apiKey: key });
    this.available = true;
    this.logger.log('Groq client initialised');

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
      this.logger.log('Gemini Flash client initialised');
    } else {
      this.logger.warn('GEMINI_API_KEY not set — cover scan will be unavailable');
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModel(role: Role, queryType?: 'deep-reasoning' | 'simple'): string {
    return this.defaultModel;
  }

  async generate(model: string, prompt: string, system?: string): Promise<{ response: string }> {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const completion = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages,
      max_tokens: 1024,
    });

    return { response: completion.choices[0]?.message?.content ?? '' };
  }

  async chat(
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<{ message: { content: string } }> {
    const completion = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages,
      max_tokens: 1024,
    });

    return { message: { content: completion.choices[0]?.message?.content ?? '' } };
  }

  async scanBookCover(base64: string): Promise<BookScanResult> {
    if (!this.gemini) {
      throw new Error('Gemini API key not configured — cannot scan cover');
    }

    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt =
      'Look at this book cover image. Extract the following information and return ONLY a valid JSON object with these exact keys: ' +
      '{"title": "...", "authors": "...", "isbn": "...", "publisher": "...", "publicationYear": 0}. ' +
      'For authors, join multiple authors with a comma. For publicationYear use a 4-digit number or 0 if unknown. ' +
      'If a field is not visible, use an empty string or 0. Return ONLY the JSON, no other text.';

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'image/jpeg', data: base64 } },
    ]);

    const raw = result.response.text();
    return this.parseBookScanResult(raw);
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
