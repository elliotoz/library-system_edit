import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AiContext } from './context-builder.service';
import { ChatResponse } from './ai.service';
import { SemanticSearchService, RankedBookResult } from './semantic-search.service';
import { SearchIntent } from './types/search.types';
import { GroqService } from './groq.service';

const MAX_TOPIC_LENGTH = 120;

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
    private readonly groq: GroqService,
  ) {}

  isLearningPathQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return INTENT_SIGNALS.some((s) => lower.includes(s));
  }

  async generatePath(ctx: AiContext, message: string): Promise<ChatResponse> {
    const topic = this.extractTopic(message, ctx);
    const intent = this.buildSearchIntent(topic, ctx);
    const context = { facultyName: ctx.user.facultyName };

    const candidates = await this.semanticSearch.searchBooks(intent, context);
    const ranked = this.semanticSearch.rankBooks(candidates, intent, context);

    if (ranked.length === 0) {
      return this.emptyResult(topic, ctx);
    }

    const stages = this.groupByDifficulty(ranked);

    // Try LLM-enhanced descriptions
    try {
      return await this.enhanceWithLLM(ctx, topic, stages);
    } catch (err) {
      this.logger.warn(`OpenRouter unavailable for learning path, using rule-based: ${err}`);
    }

    return this.formatRuleBased(topic, stages, ctx);
  }

  // ── Topic extraction ───────────────────────────────────────────

  private extractTopic(message: string, ctx: AiContext): string {
    let cleaned = message.toLowerCase();
    for (const signal of INTENT_SIGNALS) {
      cleaned = cleaned.replace(signal, '');
    }
    const noise = new Set([
      'for', 'on', 'about', 'in', 'the', 'a', 'an', 'me', 'my',
      'please', 'can', 'you', 'give', 'create', 'make', 'suggest',
      'generate', 'build', 'i', 'want', 'need', 'to',
    ]);
    const words = cleaned
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.has(w));

    let topic = words.join(' ');

    // Fallback: use interests or faculty when message is too vague
    if (!topic) {
      if (ctx.user.interests.length > 0) {
        topic = ctx.user.interests.slice(0, 2).join(' ');
      } else if (ctx.user.facultyName) {
        topic = ctx.user.facultyName;
      } else {
        topic = 'general topics';
      }
    }

    // Sanitize length to prevent prompt injection via long messages
    return topic.slice(0, MAX_TOPIC_LENGTH).trim();
  }

  // ── Search intent ──────────────────────────────────────────────

  private buildSearchIntent(topic: string, ctx: AiContext): SearchIntent {
    const keywords = topic.split(/\s+/).filter((w) => w.length > 2);

    // Enrich with user interests if topic is vague
    if (keywords.length <= 1 && ctx.user.interests.length > 0) {
      keywords.push(...ctx.user.interests.slice(0, 2));
    }

    // Enrich with borrow history categories as secondary signals
    if (keywords.length <= 1) {
      const historyCategories = [
        ...new Set(ctx.borrowHistory.recentBooks.map((b) => b.category).filter(Boolean)),
      ] as string[];
      keywords.push(...historyCategories.slice(0, 2).map((c) => c.toLowerCase()));
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

  // ── Difficulty grouping ────────────────────────────────────────

  private groupByDifficulty(books: RankedBookResult[]): {
    foundations: RankedBookResult[];
    core: RankedBookResult[];
    advanced: RankedBookResult[];
  } {
    const foundations: RankedBookResult[] = [];
    const core: RankedBookResult[] = [];
    const advanced: RankedBookResult[] = [];

    for (const book of books) {
      const combined = [
        book.title,
        book.category || '',
        ...(book.subjectTags || []),
      ].join(' ').toLowerCase();

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

  // ── Rule-based formatting ──────────────────────────────────────

  private formatRuleBased(
    topic: string,
    stages: { foundations: RankedBookResult[]; core: RankedBookResult[]; advanced: RankedBookResult[] },
    ctx: AiContext,
  ): ChatResponse {
    let reply = `## 📚 Learning Path: ${topic}\n\n`;

    reply += this.roleIntro(ctx);
    reply += this.personalContext(ctx, stages);

    reply += this.formatStage('Stage 1: Foundations', stages.foundations);
    reply += this.formatStage('Stage 2: Core', stages.core);
    reply += this.formatStage('Stage 3: Advanced', stages.advanced);

    reply += this.roleTip(ctx);
    reply += `\n---\n📖 [Browse in Catalog](/dashboard/catalog?search=${encodeURIComponent(topic)})`;

    return {
      reply,
      modelUsed: 'learning-path',
      sources: [`/dashboard/catalog?search=${encodeURIComponent(topic)}`],
    };
  }

  private roleIntro(ctx: AiContext): string {
    const { role, facultyName } = ctx.user;
    const faculty = facultyName ? ` in **${facultyName}**` : '';

    switch (role) {
      case Role.STUDENT:
        return `_Personalized learning path for you as a student${faculty}._\n\n`;
      case Role.INSTRUCTOR:
        return `_Curated reading sequence${faculty} — suitable for course design or self-study._\n\n`;
      case Role.STAFF:
        return `_Recommended reading path based on your interests._\n\n`;
      case Role.ADMIN:
        return `_Learning path overview for catalog planning._\n\n`;
      default:
        return '';
    }
  }

  private personalContext(
    ctx: AiContext,
    stages: { foundations: RankedBookResult[]; core: RankedBookResult[]; advanced: RankedBookResult[] },
  ): string {
    const lines: string[] = [];

    // Note borrow history relevance
    if (ctx.borrowHistory.recentBooks.length > 0) {
      const pastCategories = [...new Set(
        ctx.borrowHistory.recentBooks.map((b) => b.category).filter(Boolean),
      )];
      if (pastCategories.length > 0) {
        lines.push(`Based on your reading history in: ${pastCategories.join(', ')}`);
      }
    }

    // Flag books the user is currently reading
    const allBooks = [...stages.foundations, ...stages.core, ...stages.advanced];
    const activeTitles = new Set(ctx.activeBorrows.items.map((b) => b.title));
    const overlap = allBooks.filter((b) => activeTitles.has(b.title));
    if (overlap.length > 0) {
      const titles = overlap.map((b) => `"${b.title}"`).join(', ');
      lines.push(`You're currently reading ${titles} — great progress!`);
    }

    if (lines.length === 0) return '';
    return lines.map((l) => `> ${l}`).join('\n') + '\n\n';
  }

  private roleTip(ctx: AiContext): string {
    switch (ctx.user.role) {
      case Role.STUDENT: {
        const remaining = ctx.borrowPolicy.maxActiveBorrows - ctx.activeBorrows.count;
        if (remaining > 0) {
          return `\n💡 You can borrow **${remaining}** more book${remaining !== 1 ? 's' : ''}. Start with Stage 1!\n`;
        }
        return '\n💡 You\'ve reached your borrow limit. Return a book to continue.\n';
      }
      case Role.INSTRUCTOR:
        return '\n💡 You can turn this path into a [Reading List](/dashboard/instructor/reading-lists) for your students.\n';
      case Role.STAFF:
        return '\n💡 Update your [interests](/dashboard/profile) to get better personalized paths.\n';
      default:
        return '';
    }
  }

  private formatStage(title: string, books: RankedBookResult[]): string {
    if (books.length === 0) return '';

    let section = `### ${title}\n`;
    books.forEach((b) => {
      const avail = b.availableCopies > 0
        ? `✅ ${b.availableCopies} available`
        : '❌ Not available';
      section += `- **${b.title}** — ${b.authors.join(', ')} · ${avail}\n`;
    });
    section += '\n';
    return section;
  }

  // ── Empty result ───────────────────────────────────────────────

  private emptyResult(topic: string, ctx: AiContext): ChatResponse {
    let reply = `I couldn't find books for a learning path on "${topic}". `;

    if (ctx.user.interests.length > 0) {
      reply += `Try a topic closer to your interests (${ctx.user.interests.join(', ')}), or `;
    }
    reply += 'browse the [Catalog](/dashboard/catalog) for ideas.';

    return {
      reply,
      modelUsed: 'learning-path',
      sources: ['/dashboard/catalog'],
    };
  }

  // ── LLM enhancement ────────────────────────────────────────────

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

    const roleLabel = ctx.user.role.charAt(0) + ctx.user.role.slice(1).toLowerCase();

    const prompt =
      `You are a university library assistant. ` +
      `Create a brief learning path description for the topic "${topic}".\n\n` +
      `The user is a ${roleLabel}` +
      (ctx.user.facultyName ? ` in the ${ctx.user.facultyName} faculty` : '') + '.\n\n' +
      `Available books grouped by stage:\n${bookList}\n\n` +
      `RULES:\n` +
      `- Only reference books from the list above. Do not invent or suggest books outside this list.\n` +
      `- Write a 2-3 sentence overview for each stage explaining what the learner will gain.\n` +
      `- Use markdown formatting. Be concise.\n` +
      `- Do not recommend external websites, databases, or resources outside the library system.\n`;

    const model = this.groq.getModel(ctx.user.role);
    const result = await this.groq.generate(model, prompt);

    let reply = `## 📚 Learning Path: ${topic}\n\n`;
    reply += this.roleIntro(ctx);
    reply += result.response + '\n\n';
    reply += '### Recommended Books\n\n';
    reply += this.formatStage('Stage 1: Foundations', stages.foundations);
    reply += this.formatStage('Stage 2: Core', stages.core);
    reply += this.formatStage('Stage 3: Advanced', stages.advanced);
    reply += this.roleTip(ctx);
    reply += `\n---\n📖 [Browse in Catalog](/dashboard/catalog?search=${encodeURIComponent(topic)})`;

    return {
      reply,
      modelUsed: this.groq.defaultModel,
      sources: [`/dashboard/catalog?search=${encodeURIComponent(topic)}`],
    };
  }
}
