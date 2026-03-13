import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';

interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
}

interface OllamaTagsResponse {
  models: { name: string; size: number; modified_at: string }[];
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
      const text = await res.text();
      throw new Error(`Ollama generate failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<OllamaGenerateResponse>;
  }

  async listTags(): Promise<OllamaTagsResponse> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) {
      throw new Error(`Ollama tags failed (${res.status})`);
    }
    return res.json() as Promise<OllamaTagsResponse>;
  }

}
