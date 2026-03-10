import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AiContext } from './context-builder.service';
import { ChatResponse } from './ai.service';
import { SemanticSearchService, RankedBookResult } from './semantic-search.service';
import { SearchIntent } from './types/search.types';
import { CatalogSearchService } from './catalog-search.service';
import { OllamaService } from './ollama.service';

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

  private extractTopic(message: string): string {
    let cleaned = message.toLowerCase();
    for (const signal of RESEARCH_SIGNALS) {
      cleaned = cleaned.replace(signal, '');
    }
    const noise = [
      'for', 'on', 'about', 'in', 'the', 'a', 'an', 'me', 'my',
      'please', 'can', 'you', 'give', 'find', 'help', 'with',
      'need', 'want', 'i', 'to', 'some', 'do',
    ];
    const words = cleaned
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !noise.includes(w));
    return words.join(' ') || 'general research';
  }

  private buildSearchIntent(topic: string, ctx: AiContext): SearchIntent {
    const keywords = topic.split(/\s+/).filter((w) => w.length > 2);
    return {
      keywords,
      wantsAvailable: false,
      wantsReadingLists: false,
      category: null,
      audienceLevel: 'advanced',
      facultyHint: ctx.user.facultyName,
    };
  }

  private formatRuleBased(
    ctx: AiContext,
    topic: string,
    books: RankedBookResult[],
    readingLists: { id: string; title: string; ownerName: string; itemCount: number }[],
  ): ChatResponse {
    const sources: string[] = [];
    let reply = `## 🔬 Research Guide: ${topic}\n\n`;

    if (books.length > 0) {
      reply += '### Relevant Books\n';
      books.forEach((b) => {
        const avail = b.availableCopies > 0 ? `✅ ${b.availableCopies} available` : '❌ Not available';
        reply += `- **${b.title}** — ${b.authors.join(', ')} · ${avail}\n`;
      });
      reply += '\n';
      const searchParam = encodeURIComponent(topic);
      sources.push(`/dashboard/catalog?search=${searchParam}`);
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
    reply += this.nextSteps(ctx.user.role);

    return { reply, modelUsed: 'research-assist', sources };
  }

  private nextSteps(role: Role): string {
    switch (role) {
      case Role.STUDENT:
        return (
          '- Start with introductory books before moving to advanced sources\n' +
          '- Check reading lists from your instructors for curated references\n' +
          '- Use the catalog search to explore related topics\n' +
          '- Ask your instructor for guidance on narrowing your research scope\n'
        );
      case Role.INSTRUCTOR:
        return (
          '- Consider creating a reading list for this research topic\n' +
          '- Browse related categories for supplementary materials\n' +
          '- Check if key reference books need additional copies\n'
        );
      case Role.ADMIN:
        return (
          '- Review catalog coverage for this research area\n' +
          '- Consider acquiring additional resources if demand is high\n'
        );
      default:
        return (
          '- Browse the catalog for additional related books\n' +
          '- Follow instructors who publish reading lists in this area\n'
        );
    }
  }

  private async enhanceWithLLM(
    ctx: AiContext,
    topic: string,
    books: RankedBookResult[],
    readingLists: { id: string; title: string; ownerName: string; itemCount: number }[],
  ): Promise<ChatResponse> {
    const bookTitles = books.map((b) => b.title).join(', ');
    const prompt =
      `The user is researching "${topic}". ` +
      `Their role is ${ctx.user.role}` +
      (ctx.user.facultyName ? ` in ${ctx.user.facultyName}` : '') + '.\n\n' +
      `Available library books on this topic: ${bookTitles || 'none found'}.\n\n` +
      `Write a brief (3-4 sentence) research landscape summary for this topic, ` +
      `suggesting how these books can support the research. Be concise and practical.`;

    const model = this.ollama.getModel(ctx.user.role);
    const result = await this.ollama.generate(model, prompt);

    const sources: string[] = [];
    let reply = `## 🔬 Research Guide: ${topic}\n\n`;
    reply += result.response + '\n\n';

    if (books.length > 0) {
      reply += '### Relevant Books\n';
      books.forEach((b) => {
        const avail = b.availableCopies > 0 ? `✅ ${b.availableCopies} available` : '❌ Not available';
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
    reply += this.nextSteps(ctx.user.role);

    return { reply, modelUsed: result.model, sources };
  }
}
