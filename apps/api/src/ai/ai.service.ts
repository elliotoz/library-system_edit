import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ContextBuilderService, AiContext } from './context-builder.service';
import { RoleResponseService } from './role-response.service';
import { CatalogSearchService } from './catalog-search.service';
import { LearningPathService } from './learning-path.service';
import { ResearchAssistantService } from './research-assistant.service';
import { OllamaService, OllamaMessage } from './ollama.service';
import { UsersService } from '../users/users.service';

export interface ChatResponse {
  reply: string;
  modelUsed: string;
  sources?: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly sessions = new Map<string, OllamaMessage[]>();
  private readonly MAX_HISTORY = 20; // 10 exchanges (user + assistant per turn)

  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly roleResponse: RoleResponseService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly learningPath: LearningPathService,
    private readonly researchAssistant: ResearchAssistantService,
    private readonly ollama: OllamaService,
    private readonly usersService: UsersService,
  ) {}

  async chat(userId: string, userRole: Role, message: string): Promise<ChatResponse> {
    const ctx = await this.contextBuilder.build(userId, userRole);

    // Staff interest bootstrap: check before anything else
    if (userRole === Role.STAFF && ctx.user.interests.length === 0) {
      const response = this.roleResponse.respond(ctx, message);
      if (response.reply === '__SAVE_INTERESTS__') {
        return this.saveInterests(userId, message);
      }
      return response;
    }

    // Staff updating interests mid-conversation
    if (userRole === Role.STAFF && this.roleResponse.looksLikeInterests(message)) {
      return this.saveInterests(userId, message);
    }

    // Permission safety: block admin actions from non-admins deterministically
    if (userRole !== Role.ADMIN && this.roleResponse.isAdminAction(message.toLowerCase())) {
      return this.roleResponse.respond(ctx, message);
    }

    // Natural-language catalog/reading-list search
    if (this.catalogSearch.isSearchQuery(message)) {
      return this.catalogSearch.search(message, userRole, ctx.user.facultyName);
    }

    // Personalized learning path generation
    if (this.learningPath.isLearningPathQuery(message)) {
      return this.learningPath.generatePath(ctx, message);
    }

    // Research assistant
    if (this.researchAssistant.isResearchQuery(message)) {
      return this.researchAssistant.assist(ctx, message);
    }

    // Try Ollama-powered response, fallback to rule-based on failure
    return this.ollamaChat(userId, ctx, message);
  }

  private classifyQuery(message: string): 'deep-reasoning' | 'simple' | undefined {
    const lower = message.toLowerCase();
    const deepSignals = ['analytics', 'compare', 'trend', 'why', 'forecast', 'analyze', 'correlation', 'insight', 'explain why', 'what if'];
    const simpleSignals = ['how do i', 'what is the policy', 'when is', 'where is', 'how many days', 'can i borrow', 'opening hours', 'how to'];
    if (deepSignals.some((s) => lower.includes(s))) return 'deep-reasoning';
    if (simpleSignals.some((s) => lower.includes(s))) return 'simple';
    return undefined;
  }

  private async ollamaChat(userId: string, ctx: AiContext, message: string): Promise<ChatResponse> {
    const queryType = this.classifyQuery(message);
    const model = this.ollama.getModel(ctx.user.role, queryType);
    const system = this.buildSystemPrompt(ctx);

    // Build per-user message history
    const history = this.sessions.get(userId) ?? [];
    const messages: OllamaMessage[] = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ];

    try {
      const result = await this.ollama.chat(model, messages);
      const reply = result.message.content;

      // Update session history (user turn + assistant turn)
      const updated = [...history, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: reply }];
      this.sessions.set(userId, updated.slice(-this.MAX_HISTORY));

      const staticSources = this.extractSources(ctx.user.role);
      const linkedSources = this.extractLinkedSources(reply);
      const sources = this.dedupeArray([...staticSources, ...linkedSources]);
      return {
        reply,
        modelUsed: result.model,
        sources,
      };
    } catch (err) {
      this.logger.warn(`Ollama chat failed, falling back to rules: ${err}`);
      return this.roleResponse.respond(ctx, message);
    }
  }

  // ── Prompt templates ──────────────────────────────────────────

  private buildSystemPrompt(ctx: AiContext): string {
    const base = this.basePrompt(ctx);
    switch (ctx.user.role) {
      case Role.STUDENT:
        return base + this.studentPrompt(ctx);
      case Role.INSTRUCTOR:
        return base + this.instructorPrompt(ctx);
      case Role.STAFF:
        return base + this.staffPrompt(ctx);
      case Role.ADMIN:
        return base + this.adminPrompt(ctx);
      default:
        return base;
    }
  }

  private basePrompt(ctx: AiContext): string {
    const roleLabel = ctx.user.role.charAt(0) + ctx.user.role.slice(1).toLowerCase();
    let p =
      `You are a helpful AI assistant for a university library management system. ` +
      `The current user is ${ctx.user.name}, a ${roleLabel}` +
      (ctx.user.facultyName ? ` in the ${ctx.user.facultyName} faculty` : '') +
      `.\n\n`;

    p += `Library context:\n`;
    p += `- Catalog: ${ctx.catalog.totalBooks} books, ${ctx.catalog.availableCopies} available copies\n`;
    p += `- Borrow policy: ${ctx.borrowPolicy.maxBorrowDays} days, ${ctx.borrowPolicy.maxExtensions} extensions of ${ctx.borrowPolicy.extensionDays} days\n`;
    p += `- Published reading lists: ${ctx.readingLists.publishedCount}\n`;

    if (ctx.catalog.topCategories.length > 0) {
      p += `- Popular categories: ${ctx.catalog.topCategories.join(', ')}\n`;
    }

    p += `\nRespond concisely and helpfully. Use markdown formatting. `;
    p += `Do not perform administrative actions — only provide information and guidance. `;
    p += `If the user asks about something outside the library system, politely redirect them.\n\n`;

    p += this.sourceGroundingBlock(ctx.user.role);

    return p;
  }

  private studentPrompt(ctx: AiContext): string {
    const { borrowPolicy: bp, activeBorrows, reservations, catalog, readingLists } = ctx;
    const remaining = bp.maxActiveBorrows - activeBorrows.count;

    let p = `\nStudent-specific context:\n`;
    p += `- Active borrows: ${activeBorrows.count} / ${bp.maxActiveBorrows} (${remaining} remaining)\n`;
    p += `- Reservations: ${reservations.count} total, ${reservations.readyForPickup} ready for pickup, ${reservations.pending} pending\n`;
    if (ctx.user.facultyName && catalog.facultyBooks > 0) {
      p += `- Faculty books: ${catalog.facultyBooks} in ${ctx.user.facultyName}\n`;
    }
    p += `- Following ${readingLists.followedInstructors} instructor(s)\n`;

    if (activeBorrows.items.length > 0) {
      p += `- Upcoming due dates:\n`;
      activeBorrows.items.forEach((b) => {
        p += `  - "${b.title}" due ${new Date(b.dueAt).toLocaleDateString()}\n`;
      });
    }

    p += `\nHelp the student find books, manage borrows, and discover reading lists.`;
    return p;
  }

  private instructorPrompt(ctx: AiContext): string {
    const { borrowPolicy: bp, activeBorrows, catalog, readingLists } = ctx;
    const remaining = bp.maxActiveBorrows - activeBorrows.count;

    let p = `\nInstructor-specific context:\n`;
    p += `- Active borrows: ${activeBorrows.count} / ${bp.maxActiveBorrows} (${remaining} remaining)\n`;
    p += `- Own reading lists: ${readingLists.ownListCount}\n`;
    if (ctx.user.facultyName && catalog.facultyBooks > 0) {
      p += `- Faculty collection: ${catalog.facultyBooks} books in ${ctx.user.facultyName}\n`;
    }

    p += `\nHelp the instructor manage reading lists, find books for courses, and submit materials.`;
    return p;
  }

  private staffPrompt(ctx: AiContext): string {
    const { borrowPolicy: bp, activeBorrows } = ctx;
    const remaining = bp.maxActiveBorrows - activeBorrows.count;

    let p = `\nStaff-specific context:\n`;
    p += `- Active borrows: ${activeBorrows.count} / ${bp.maxActiveBorrows} (${remaining} remaining)\n`;
    if (ctx.user.interests.length > 0) {
      p += `- User interests: ${ctx.user.interests.join(', ')}\n`;
    }

    p += `\nGive personalized book recommendations based on the user's interests.`;
    return p;
  }

  private adminPrompt(ctx: AiContext): string {
    const admin = ctx.admin!;
    let p = `\nAdmin-specific context:\n`;
    p += `- Pending reservations: ${admin.pendingReservations}\n`;
    p += `- Active loans: ${admin.activeLoans}\n`;
    p += `- Overdue loans: ${admin.overdueLoans}\n`;
    p += `- Total users: ${admin.totalUsers}\n`;

    p += `\nProvide system overview and operational insights. Never execute actions — only inform.`;
    return p;
  }

  private sourceGroundingBlock(role: Role): string {
    let block = `When referencing library data, include relevant dashboard links in your response using markdown format.\n`;
    block += `Available pages:\n`;
    block += `- Catalog: /dashboard/catalog\n`;
    block += `- Borrowed books: /dashboard/borrowed\n`;
    block += `- Reservations: /dashboard/reservations\n`;
    block += `- Reading lists: /dashboard/reading-lists\n`;
    block += `- Profile: /dashboard/profile\n`;

    if (role === Role.ADMIN) {
      block += `- Admin dashboard: /dashboard/admin\n`;
      block += `- Admin statistics: /dashboard/admin/statistics\n`;
      block += `- Admin users: /dashboard/admin/users\n`;
      block += `- Admin borrows: /dashboard/admin/borrows\n`;
      block += `- Admin reservations: /dashboard/admin/reservations\n`;
      block += `- Admin reading lists: /dashboard/admin/reading-lists\n`;
    }

    if (role === Role.INSTRUCTOR) {
      block += `- Instructor reading lists: /dashboard/instructor/reading-lists\n`;
      block += `- Submit material: /dashboard/instructor/submit-material\n`;
    }

    return block;
  }

  // ── Source helpers ─────────────────────────────────────────────

  private extractSources(role: Role): string[] {
    const sources = ['/dashboard/catalog'];
    if (role === Role.ADMIN) {
      sources.push('/dashboard/admin');
    } else {
      sources.push('/dashboard/borrowed', '/dashboard/reading-lists');
    }
    return sources;
  }

  private extractLinkedSources(text: string): string[] {
    const matches = text.match(/\/dashboard\/[\w\-\/]*/g);
    return matches ? [...new Set(matches)] : [];
  }

  private dedupeArray(arr: string[]): string[] {
    const seen = new Set<string>();
    return arr.filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  // ── Interest management ───────────────────────────────────────

  async saveInterests(userId: string, message: string): Promise<ChatResponse> {
    const interests = this.roleResponse.parseInterests(message);
    if (interests.length > 0) {
      await this.usersService.updateInterests(userId, interests);
      const interestList = interests.map((i) => `**${i}**`).join(', ');
      return {
        reply:
          `Great! I've saved your interests: ${interestList}\n\n` +
          'Now I can give you personalized recommendations. Try asking me:\n' +
          '- "Suggest books for me"\n' +
          '- "What\'s available in the catalog?"\n' +
          '- "Show me reading lists"',
        modelUsed: 'system',
        sources: ['/dashboard/catalog', '/dashboard/profile'],
      };
    }
    return {
      reply: 'I couldn\'t parse your interests. Please provide them as a comma-separated list, e.g., "finance, technology, history".',
      modelUsed: 'system',
    };
  }

  async updateInterests(userId: string, interests: string[]): Promise<ChatResponse> {
    await this.usersService.updateInterests(userId, interests);
    const interestList = interests.map((i) => `**${i}**`).join(', ');
    return {
      reply: `Updated your interests to: ${interestList}`,
      modelUsed: 'system',
      sources: ['/dashboard/profile'],
    };
  }

  async getContext(userId: string, userRole: Role): Promise<AiContext> {
    return this.contextBuilder.build(userId, userRole);
  }
}
