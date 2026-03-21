import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
}

interface OllamaChatResponse {
  message: OllamaMessage;
  model: string;
  done: boolean;
}

interface OllamaTagsResponse {
  models: { name: string; size: number; modified_at: string }[];
}

export interface BookScanResult {
  title?: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
}

const MODEL_MAP: Record<Role, string> = {
  STAFF: 'phi3',
  STUDENT: 'qwen2.5',
  INSTRUCTOR: 'qwen2.5',
  ADMIN: 'llama3',
};

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private available = false;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async onModuleInit() {
    try {
      await this.listTags();
      this.available = true;
      this.logger.log(`Ollama connected at ${this.baseUrl}`);
    } catch {
      this.available = false;
      this.logger.warn(
        `Ollama not reachable at ${this.baseUrl} — AI chat will fall back to rule-based responses`,
      );
    }
  }

  /** Returns true if Ollama was reachable on startup */
  isAvailable(): boolean {
    return this.available;
  }

  getModel(role: Role, queryType?: 'deep-reasoning' | 'simple'): string {
    if (queryType === 'deep-reasoning') return 'llama3';
    if (queryType === 'simple') return 'phi3';
    return MODEL_MAP[role] ?? 'qwen2.5';
  }

  async generate(model: string, prompt: string, system?: string): Promise<OllamaGenerateResponse> {
    const body: Record<string, unknown> = { model, prompt, stream: false };
    if (system) body.system = system;

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      this.available = false;
      const text = await res.text();
      throw new Error(`Ollama generate failed (${res.status}): ${text}`);
    }

    this.available = true;
    return res.json() as Promise<OllamaGenerateResponse>;
  }

  async chat(model: string, messages: OllamaMessage[]): Promise<OllamaChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      this.available = false;
      const text = await res.text();
      throw new Error(`Ollama chat failed (${res.status}): ${text}`);
    }

    this.available = true;
    return res.json() as Promise<OllamaChatResponse>;
  }

  async scanBookCover(base64: string): Promise<BookScanResult> {
    const prompt =
      'Look at this book cover image. Extract the following information and return ONLY a valid JSON object with these exact keys: ' +
      '{"title": "...", "authors": "...", "isbn": "...", "publisher": "...", "publicationYear": 0}. ' +
      'For authors, join multiple authors with a comma. For publicationYear use a 4-digit number or 0 if unknown. ' +
      'If a field is not visible, use an empty string or 0. Return ONLY the JSON, no other text.';

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemma3:4b', prompt, images: [base64], stream: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama scan failed (${res.status}): ${text}`);
    }

    const data = await res.json() as OllamaGenerateResponse;
    return this.parseBookScanResult(data.response);
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

  async listTags(): Promise<OllamaTagsResponse> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) {
      throw new Error(`Ollama tags failed (${res.status})`);
    }
    return res.json() as Promise<OllamaTagsResponse>;
  }

}
