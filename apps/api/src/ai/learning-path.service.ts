import { Injectable, Logger } from '@nestjs/common';
import { AiContext } from './context-builder.service';
import { ChatResponse } from './ai.service';
import { SemanticSearchService, RankedBookResult } from './semantic-search.service';
import { SearchIntent } from './types/search.types';
import { OllamaService } from './ollama.service';

const INTENT_SIGNALS = [
  'learning path',
  'study plan',
  'what should i read',
  'reading order',
  'curriculum',
  'roadmap',
  'sequence of books',
  'start with which book',
  'beginner to advanced',
];

const INTRO_KEYWORDS = [
  'introduction', 'introductory', 'beginner', 'fundamentals',
  'primer', 'essentials', 'basics', 'first course', 'getting started',
];

const ADVANCED_KEYWORDS = [
  'advanced', 'graduate', 'research', 'comprehensive',
  'in-depth', 'specialist', 'mastering', 'expert',
];

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    private readonly semanticSearch: SemanticSearchService,
    private readonly ollama: OllamaService,
  ) {}

  isLearningPathQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return INTENT_SIGNALS.some((s) => lower.includes(s));
  }

  async generatePath(ctx: AiContext, message: string): Promise<ChatResponse> {
    const topic = this.extractTopic(message);
    const intent = this.buildSearchIntent(topic, ctx);
    const context = { facultyName: ctx.user.facultyName };

    const candidates = await this.semanticSearch.searchBooks(intent, context);
    const ranked = this.semanticSearch.rankBooks(candidates, intent, context);

    if (ranked.length === 0) {
      return {
        reply:
          `I couldn't find books for a learning path on "${topic}". ` +
          `Try browsing the [Catalog](/dashboard/catalog) or refining your topic.`,
        modelUsed: 'learning-path',
        sources: ['/dashboard/catalog'],
      };
    }

    const stages = this.groupByDifficulty(ranked);

    // Try LLM-enhanced descriptions
    try {
      const enhanced = await this.enhanceWithLLM(ctx, topic, stages);
      return enhanced;
    } catch (err) {
      this.logger.warn(`Ollama unavailable for learning path, using rule-based: ${err}`);
    }

    return this.formatRuleBased(topic, stages, ctx);
  }

  private extractTopic(message: string): string {
    let cleaned = message.toLowerCase();
    for (const signal of INTENT_SIGNALS) {
      cleaned = cleaned.replace(signal, '');
    }
    // Remove common filler words
    const noise = [
      'for', 'on', 'about', 'in', 'the', 'a', 'an', 'me', 'my',
      'please', 'can', 'you', 'give', 'create', 'make', 'suggest',
      'generate', 'build', 'i', 'want', 'need', 'to',
    ];
    const words = cleaned
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.includes(w));
    return words.join(' ') || 'general topics';
  }

  private buildSearchIntent(topic: string, ctx: AiContext): SearchIntent {
    const keywords = topic.split(/\s+/).filter((w) => w.length > 2);

    // Enrich with user interests if topic is vague
    if (keywords.length <= 1 && ctx.user.interests.length > 0) {
      keywords.push(...ctx.user.interests.slice(0, 2));
    }

    return {
      keywords,
      wantsAvailable: false,
      wantsReadingLists: false,
      category: null,
      audienceLevel: null,
      facultyHint: ctx.user.facultyName,
    };
  }

  private groupByDifficulty(books: RankedBookResult[]): {
    foundations: RankedBookResult[];
    core: RankedBookResult[];
    advanced: RankedBookResult[];
  } {
    const foundations: RankedBookResult[] = [];
    const core: RankedBookResult[] = [];
    const advanced: RankedBookResult[] = [];

    for (const book of books) {
      const combined = (book.title + ' ' + (book.subjectTags?.join(' ') || '')).toLowerCase();

      if (ADVANCED_KEYWORDS.some((kw) => combined.includes(kw))) {
        advanced.push(book);
      } else if (INTRO_KEYWORDS.some((kw) => combined.includes(kw))) {
        foundations.push(book);
      } else {
        core.push(book);
      }
    }

    // Ensure at least some distribution — move overflow from core
    if (foundations.length === 0 && core.length > 1) {
      foundations.push(core.shift()!);
    }
    if (advanced.length === 0 && core.length > 1) {
      advanced.push(core.pop()!);
    }

    return { foundations, core, advanced };
  }

  private formatRuleBased(
    topic: string,
    stages: { foundations: RankedBookResult[]; core: RankedBookResult[]; advanced: RankedBookResult[] },
    ctx: AiContext,
  ): ChatResponse {
    let reply = `## 📚 Learning Path: ${topic}\n\n`;

    if (ctx.borrowHistory.recentBooks.length > 0) {
      const pastCategories = [...new Set(ctx.borrowHistory.recentBooks.map((b) => b.category).filter(Boolean))];
      if (pastCategories.length > 0) {
        reply += `_Based on your reading history in: ${pastCategories.join(', ')}_\n\n`;
      }
    }

    reply += this.formatStage('Stage 1: Foundations', stages.foundations);
    reply += this.formatStage('Stage 2: Core', stages.core);
    reply += this.formatStage('Stage 3: Advanced', stages.advanced);

    reply += `\n---\n💡 Visit the [Catalog](/dashboard/catalog?search=${encodeURIComponent(topic)}) to borrow these books.`;

    return {
      reply,
      modelUsed: 'learning-path',
      sources: [`/dashboard/catalog?search=${encodeURIComponent(topic)}`],
    };
  }

  private formatStage(title: string, books: RankedBookResult[]): string {
    if (books.length === 0) return '';

    let section = `### ${title}\n`;
    books.forEach((b) => {
      const avail = b.availableCopies > 0 ? `✅ ${b.availableCopies} available` : '❌ Not available';
      section += `- **${b.title}** — ${b.authors.join(', ')} · ${avail}\n`;
    });
    section += '\n';
    return section;
  }

  private async enhanceWithLLM(
    ctx: AiContext,
    topic: string,
    stages: { foundations: RankedBookResult[]; core: RankedBookResult[]; advanced: RankedBookResult[] },
  ): Promise<ChatResponse> {
    const bookList = [
      ...stages.foundations.map((b) => `[Foundation] ${b.title}`),
      ...stages.core.map((b) => `[Core] ${b.title}`),
      ...stages.advanced.map((b) => `[Advanced] ${b.title}`),
    ].join('\n');

    const prompt =
      `Create a brief learning path description for the topic "${topic}". ` +
      `The student's role is ${ctx.user.role}` +
      (ctx.user.facultyName ? ` in ${ctx.user.facultyName}` : '') + '.\n\n' +
      `Available books grouped by stage:\n${bookList}\n\n` +
      `Write a 2-3 sentence overview for each stage explaining what the student will learn. ` +
      `Use markdown formatting. Be concise.`;

    const model = this.ollama.getModel(ctx.user.role);
    const result = await this.ollama.generate(model, prompt);

    let reply = `## 📚 Learning Path: ${topic}\n\n`;
    reply += result.response + '\n\n';
    reply += '### Recommended Books\n\n';
    reply += this.formatStage('Stage 1: Foundations', stages.foundations);
    reply += this.formatStage('Stage 2: Core', stages.core);
    reply += this.formatStage('Stage 3: Advanced', stages.advanced);
    reply += `\n---\n💡 Visit the [Catalog](/dashboard/catalog?search=${encodeURIComponent(topic)}) to borrow these books.`;

    return {
      reply,
      modelUsed: result.model,
      sources: [`/dashboard/catalog?search=${encodeURIComponent(topic)}`],
    };
  }
}
