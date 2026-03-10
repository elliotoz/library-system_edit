import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AiContext } from './context-builder.service';
import { ChatResponse } from './ai.service';
import { SemanticSearchService, RankedBookResult } from './semantic-search.service';
import { SearchIntent, ReadingListResult } from './types/search.types';
import { CatalogSearchService } from './catalog-search.service';
import { OllamaService } from './ollama.service';

const MAX_TOPIC_LENGTH = 120;

const RESEARCH_SIGNALS = [
  'research',
  'thesis',
  'dissertation',
  'literature review',
  'academic paper',
  'scholarly',
  'references for',
  'sources for',
  'bibliography',
  'survey of',
];

@Injectable()
export class ResearchAssistantService {
  private readonly logger = new Logger(ResearchAssistantService.name);

  constructor(
    private readonly semanticSearch: SemanticSearchService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly ollama: OllamaService,
  ) {}

  isResearchQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return RESEARCH_SIGNALS.some((s) => lower.includes(s));
  }

  async assist(ctx: AiContext, message: string): Promise<ChatResponse> {
    const topic = this.extractTopic(message);
    const intent = this.buildSearchIntent(topic, ctx);
    const context = { facultyName: ctx.user.facultyName };

    const [candidates, readingLists] = await Promise.all([
      this.semanticSearch.searchBooks(intent, context),
      this.catalogSearch.searchReadingLists(topic),
    ]);

    const books = this.semanticSearch.rankBooks(candidates, intent, context);

    // Try LLM-enhanced summary
    try {
      return await this.enhanceWithLLM(ctx, topic, books, readingLists);
    } catch (err) {
      this.logger.warn(`Ollama unavailable for research assist, using rule-based: ${err}`);
    }

    return this.formatRuleBased(ctx, topic, books, readingLists);
  }

  // ── Topic extraction ───────────────────────────────────────────

  private extractTopic(message: string): string {
    let cleaned = message.toLowerCase();
    for (const signal of RESEARCH_SIGNALS) {
      cleaned = cleaned.replace(signal, '');
    }
    const noise = new Set([
      'for', 'on', 'about', 'in', 'the', 'a', 'an', 'me', 'my',
      'please', 'can', 'you', 'give', 'find', 'help', 'with',
      'need', 'want', 'i', 'to', 'some', 'do',
    ]);
    const words = cleaned
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.has(w));

    const topic = words.join(' ') || 'general research';
    return topic.slice(0, MAX_TOPIC_LENGTH).trim();
  }

  // ── Search intent ──────────────────────────────────────────────

  private buildSearchIntent(topic: string, ctx: AiContext): SearchIntent {
    const keywords = topic.split(/\s+/).filter((w) => w.length > 2);

    // Role-aware audience level: students benefit from a mix,
    // instructors and admins want advanced material
    const audienceLevel = this.audienceLevelForRole(ctx.user.role);

    return {
      keywords,
      wantsAvailable: false,
      wantsReadingLists: false,
      category: null,
      audienceLevel,
      facultyHint: ctx.user.facultyName,
    };
  }

  private audienceLevelForRole(role: Role): 'introductory' | 'advanced' | null {
    switch (role) {
      case Role.INSTRUCTOR:
      case Role.ADMIN:
        return 'advanced';
      case Role.STUDENT:
      case Role.STAFF:
      default:
        // Students and staff benefit from seeing all levels
        return null;
    }
  }

  // ── Rule-based formatting ──────────────────────────────────────

  private formatRuleBased(
    ctx: AiContext,
    topic: string,
    books: RankedBookResult[],
    readingLists: ReadingListResult[],
  ): ChatResponse {
    const sources: string[] = [];
    let reply = `## 🔬 Research Guide: ${topic}\n\n`;

    reply += this.priorReadingNote(ctx, books);

    if (books.length > 0) {
      reply += '### Relevant Books\n';
      books.forEach((b) => {
        const avail = b.availableCopies > 0
          ? `✅ ${b.availableCopies} available`
          : '❌ Not available';
        reply += `- **${b.title}** — ${b.authors.join(', ')} · ${avail}\n`;
      });
      reply += '\n';
      sources.push(`/dashboard/catalog?search=${encodeURIComponent(topic)}`);
    } else {
      reply += `No books found matching "${topic}" in the catalog.\n\n`;
      sources.push('/dashboard/catalog');
    }

    if (readingLists.length > 0) {
      reply += '### Related Reading Lists\n';
      readingLists.forEach((rl) => {
        reply += `- **${rl.title}** by ${rl.ownerName} (${rl.itemCount} book${rl.itemCount !== 1 ? 's' : ''})\n`;
      });
      reply += '\n';
      sources.push('/dashboard/reading-lists');
    }

    reply += '### Suggested Next Steps\n';
    reply += this.nextSteps(ctx);

    return { reply, modelUsed: 'research-assist', sources };
  }

  // ── Borrow history awareness ───────────────────────────────────

  private priorReadingNote(ctx: AiContext, books: RankedBookResult[]): string {
    if (ctx.borrowHistory.recentBooks.length === 0) return '';

    const returnedTitles = new Set(ctx.borrowHistory.recentBooks.map((b) => b.title));
    const alreadyRead = books.filter((b) => returnedTitles.has(b.title));

    if (alreadyRead.length === 0) return '';

    const titles = alreadyRead.map((b) => `"${b.title}"`).join(', ');
    return `> You've previously read ${titles} — these can serve as your foundation.\n\n`;
  }

  // ── Context-aware next steps ───────────────────────────────────

  private nextSteps(ctx: AiContext): string {
    const { role } = ctx.user;
    const lines: string[] = [];

    switch (role) {
      case Role.STUDENT: {
        lines.push('- Start with introductory books before moving to advanced sources');
        if (ctx.readingLists.followedInstructors > 0) {
          lines.push(`- Check reading lists from your **${ctx.readingLists.followedInstructors}** followed instructor${ctx.readingLists.followedInstructors !== 1 ? 's' : ''} for curated references`);
        } else {
          lines.push('- Follow instructors in your area to discover curated reading lists');
        }
        lines.push('- Use the [catalog search](/dashboard/catalog) to explore related topics');
        const remaining = ctx.borrowPolicy.maxActiveBorrows - ctx.activeBorrows.count;
        if (remaining > 0) {
          lines.push(`- You can borrow **${remaining}** more book${remaining !== 1 ? 's' : ''} right now`);
        }
        break;
      }
      case Role.INSTRUCTOR: {
        lines.push('- Consider creating a [reading list](/dashboard/instructor/reading-lists) for this research topic');
        lines.push('- Browse related categories for supplementary materials');
        if (ctx.readingLists.ownListCount > 0) {
          lines.push(`- You already have **${ctx.readingLists.ownListCount}** reading list${ctx.readingLists.ownListCount !== 1 ? 's' : ''}. Add relevant books to an existing one.`);
        }
        break;
      }
      case Role.ADMIN: {
        lines.push('- Review catalog coverage for this research area');
        if (ctx.catalog.availableCopies < 10) {
          lines.push('- Note: available copies are running low across the catalog');
        }
        lines.push('- Consider acquiring additional resources if demand is high');
        break;
      }
      default: {
        lines.push('- Browse the [catalog](/dashboard/catalog) for additional related books');
        lines.push('- Follow instructors who publish reading lists in this area');
        break;
      }
    }

    return lines.join('\n') + '\n';
  }

  // ── LLM enhancement ────────────────────────────────────────────

  private async enhanceWithLLM(
    ctx: AiContext,
    topic: string,
    books: RankedBookResult[],
    readingLists: ReadingListResult[],
  ): Promise<ChatResponse> {
    const bookTitles = books.map((b) => b.title).join(', ');
    const roleLabel = ctx.user.role.charAt(0) + ctx.user.role.slice(1).toLowerCase();

    const prompt =
      `You are a university library research assistant. ` +
      `The user is a ${roleLabel} researching "${topic}"` +
      (ctx.user.facultyName ? ` in the ${ctx.user.facultyName} faculty` : '') + '.\n\n' +
      `Available library books on this topic: ${bookTitles || 'none found'}.\n\n` +
      `RULES:\n` +
      `- Only reference books from the list above. Do not invent or suggest books outside this list.\n` +
      `- Write a brief (3-4 sentence) research landscape summary for this topic.\n` +
      `- Suggest how the listed books can support the research.\n` +
      `- Do not recommend external websites, databases, or resources outside the library system.\n` +
      `- Be concise and practical.\n`;

    const model = this.ollama.getModel(ctx.user.role);
    const result = await this.ollama.generate(model, prompt);

    const sources: string[] = [];
    let reply = `## 🔬 Research Guide: ${topic}\n\n`;
    reply += this.priorReadingNote(ctx, books);
    reply += result.response + '\n\n';

    if (books.length > 0) {
      reply += '### Relevant Books\n';
      books.forEach((b) => {
        const avail = b.availableCopies > 0
          ? `✅ ${b.availableCopies} available`
          : '❌ Not available';
        reply += `- **${b.title}** — ${b.authors.join(', ')} · ${avail}\n`;
      });
      reply += '\n';
      sources.push(`/dashboard/catalog?search=${encodeURIComponent(topic)}`);
    }

    if (readingLists.length > 0) {
      reply += '### Related Reading Lists\n';
      readingLists.forEach((rl) => {
        reply += `- **${rl.title}** by ${rl.ownerName} (${rl.itemCount} book${rl.itemCount !== 1 ? 's' : ''})\n`;
      });
      reply += '\n';
      sources.push('/dashboard/reading-lists');
    }

    reply += '### Suggested Next Steps\n';
    reply += this.nextSteps(ctx);

    return { reply, modelUsed: result.model, sources };
  }
}
