import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSearchService } from './catalog-search.service';
import { BorrowStatus, BookCopyStatus, FineStatus, IndexStatus, Role } from '@prisma/client';
import { buildSystemPrompt as buildSystemPromptFromModule, PromptContext, ResponseIntent } from './prompts/system-prompt-builder';
import { ToolHookService } from './tools/tool-hook.service';
import { ToolExecutionContext } from './tools/tool-hooks';
import { TokenTrackerService } from './session/token-tracker.service';
import { MaterialSearchService } from '../materials/material-search.service';
import { buildMaterialAccessWhere } from '../materials/material-access.util';
import { BookDocumentService, BookPdfContent } from '../books/book-document.service';
import { OPENROUTER_MODELS } from './providers/openrouter.provider';
import { AUTO_MODEL_ID, getModelEntry, getPublicModelList, isAllowlistedModel } from './model-registry';
import { AiModeState, buildAiModeState, buildModeInstructionBlock, getDefaultAutoModes, inferAutoModes, normalizeAiModes } from './ai-modes';
import { PythonExecutionService } from './python/python-execution.service';

export interface BookCitation {
  title: string;
  catalogLink: string;
  available: boolean;
  copies: string;
}

export type ModelSelectionSource = 'auto' | 'manual' | 'capability_fallback' | 'rate_limit_fallback';

export interface ConversationModelState {
  manualModel: string | null;
  lastResolvedModel: string | null;
  lastModelSelectionSource: ModelSelectionSource | null;
  activeModel: string | null;
  reason: string | null;
}

type ConversationMemoryMessage = { role: string; content: string };
type LiteralPieChartSpec = { title: string; labels: string[]; values: number[] };

export type ChatChunk =
  | { type: 'mode_state'; modeState: AiModeState }
  | { type: 'model_state'; modelState: ConversationModelState }
  | { type: 'text'; text: string }
  | { type: 'books'; books: BookCitation[] };

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly openRouterBaseUrl = 'https://openrouter.ai/api/v1';
  private readonly chatMaxTokens = 2048;
  private readonly studyGuideMaxTokens = 1536;

  private static readonly MEMORY_RECALL_LIMITS = {
    recentContextMessages: 50,
    directRecallMaxMessages: 60,
    maxMessagesProcessedPerRecall: 300,
    chunkSizeMessages: 30,
    maxChunksPerRecall: 10,
    maxSummaryTokensPerChunk: 350,
    maxFinalSummaryTokens: 900,
  } as const;

  private static readonly FINAL_PROVIDER_FAILURE_MESSAGES: Record<number, string> = {
    402: 'OZ AI is out of credits for this session. Your conversation has been saved. Please try again later.',
    429: 'OZ AI is being rate limited. Please wait a moment and try your message again.',
    503: 'OZ AI is temporarily unavailable. Your conversation has been saved. Please try again shortly.',
  };

  private static readonly DEFAULT_PROVIDER_FAILURE_MESSAGE =
    'OZ AI encountered an unexpected provider error. Your conversation has been saved. Please try again.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly toolHookService: ToolHookService,
    private readonly tokenTrackerService: TokenTrackerService,
    private readonly materialSearch: MaterialSearchService,
    private readonly bookDocumentService: BookDocumentService,
    private readonly pythonExecution: PythonExecutionService,
  ) {}

  // ── Status ─────────────────────────────────────────────────────

  async getStatus(): Promise<{ available: boolean; model: string }> {
    return {
      available: !!process.env.OPENROUTER_API_KEY,
      model: OPENROUTER_MODELS.CHEAP,
    };
  }

  private get openRouterHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'X-Title': 'LibrarySystem',
    };
  }

  private parseProviderErrorMessage(status: number, errText: string): string {
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } };
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // fall through to generic handling
    }

    if (status === 402) {
      return 'OZ AI is temporarily unavailable because the OpenRouter account does not currently have enough credits or output-token budget for this request.';
    }

    return `AI provider error: ${status}`;
  }

  private getUserFacingProviderError(status: number, errText: string): string {
    if (status === 402) {
      return 'OZ AI is temporarily unavailable because the current OpenRouter credits or token budget are too low for this request. Try again later or reduce the requested output size.';
    }

    if (status === 429) {
      return 'OZ AI is being rate limited right now. Please wait a moment and try again.';
    }

    return this.parseProviderErrorMessage(status, errText);
  }

  /** Pick model tier based on message complexity, respecting an explicit override. */
  private pickModel(message: string, hasImage: boolean, override?: string): string {
    if (override) return override;
    if (hasImage) return OPENROUTER_MODELS.CHEAP;
    if (this.isDeepQuery(message)) return OPENROUTER_MODELS.SMART;
    if (this.isSimpleMessage(message)) return OPENROUTER_MODELS.FREE;
    return OPENROUTER_MODELS.CHEAP;
  }

  /** Deep analytical questions that benefit from a smarter model. */
  private isDeepQuery(message: string): boolean {
    const lower = message.toLowerCase();
    const signals = ['analyze', 'analyse', 'compare', 'trend', 'forecast', 'correlation',
      'insight', 'explain why', 'what if', 'summarize the', 'summary of',
      'recommend a learning', 'study plan', 'research', 'evaluate'];
    return signals.some((s) => lower.includes(s));
  }

  /** Simple greetings/chat — no tools needed. */
  private isSimpleMessage(message: string): boolean {
    const lower = message.trim().toLowerCase();
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'thanks', 'thank you', 'bye', 'goodbye', 'how are you', 'whats up', "what's up",
      'ok', 'okay', 'cool', 'nice', 'great', 'yes', 'no', 'sure', 'help'];
    if (greetings.some((g) => lower === g || lower === g + '!')) return true;
    if (lower.length < 15 && !lower.includes('book') && !lower.includes('borrow') &&
        !lower.includes('catalog') && !lower.includes('search') && !lower.includes('find') &&
        !lower.includes('reserve') && !lower.includes('reading') && !lower.includes('overdue') &&
        !lower.includes('stat') && !lower.includes('user')) return true;
    return false;
  }

  private detectScientificOutput(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      this.isTechnicalOrScientificQuery(message) ||
      /\bplot\b|\bgraph\b|\bchart\b|visuali[sz]e/.test(lower) ||
      /flowchart|sequence diagram|er diagram|architecture diagram/.test(lower)
    );
  }

  private isTechnicalOrScientificQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      /typescript|javascript|python|sql|debug|compile|refactor|algorithm/.test(lower) ||
      /equation|matrix|derivative|integral|solve|proof|theorem/.test(lower) ||
      /gauss.?seidel|gaussian elimination|lu decomposition|cholesky|newton.?raphson/.test(lower) ||
      /interpolation|numerical integration|differential equation|linear algebra/.test(lower) ||
      /physics|chemistry|biology|lab|statistics|probability|regression/.test(lower) ||
      /circuit|force|beam|simulation|engineering|thermodynamics|kinematics/.test(lower) ||
      /\bplot\b|\bgraph\b|\bchart\b|visuali[sz]e|dataframe/.test(lower)
    );
  }

  private isAdminAnalyticsRequest(message: string): boolean {
    const lower = message.toLowerCase();
    const hasAdminDashboardIntent = /\badmin\b|\badministrative\b|\banalytics dashboard\b|\bdashboard\b/.test(lower);
    const hasRestrictedMetric =
      /\bborrowed books? by faculty\b|\bby faculty\b|\bfine payments?\b|\bfines? summary\b|\bmost borrowed\b|\bmost popular\b|\bborrowed (the )?most\b/.test(lower) ||
      /\breservations? per\b|\breservation trends?\b|\boverdue books? trend\b|\boverdue trends?\b/.test(lower);
    const hasOperationalMetric =
      /\bborrowed books?\b|\breservations?\b|\boverdue\b|\bfines?\b|\bfine payments?\b|\bfaculty\b|\bcategor(?:y|ies)\b/.test(lower);
    const hasAnalyticsIntent = /\banalytics?\b|\bcharts?\b|\bgraphs?\b|\btrends?\b|\breports?\b/.test(lower);

    return hasRestrictedMetric || (hasOperationalMetric && hasAdminDashboardIntent && hasAnalyticsIntent);
  }

  private isMostBorrowedCategoryRequest(message: string): boolean {
    const lower = message.toLowerCase();
    return /\b(most borrowed|most popular|borrowed (?:the )?most)\b/.test(lower) && /\bcategor(?:y|ies)\b/.test(lower);
  }

  private isMostBorrowedBookRequest(message: string): boolean {
    const lower = message.toLowerCase();
    const hasMostBorrowedIntent = /\b(most borrowed|most popular|borrowed (?:the )?most)\b/.test(lower);
    const hasBookIntent = /\bbooks?\b|\btitles?\b/.test(lower);
    return hasMostBorrowedIntent && hasBookIntent && !this.isMostBorrowedCategoryRequest(message);
  }

  private buildAdminAnalyticsDeniedResponse(role: Role): string {
    const roleLabel = role.toLowerCase();
    return [
      'That request requires administrator privileges.',
      '',
      `As a **${roleLabel}**, I cannot generate admin analytics dashboards, access admin-only operational data, or invent sample data for borrowed-book, reservation, overdue, or fine-payment charts.`,
      '',
      'I can still help you with your own borrows, reservations, reading lists, catalog searches, or study materials.',
    ].join('\n');
  }

  private parseLiteralPieChartRequest(message: string): LiteralPieChartSpec | null {
    if (!/\bpie\s+chart\b/i.test(message)) return null;

    const entries: Array<{ label: string; value: number }> = [];
    const pattern = /(?:^|\n|[-*]\s*)([A-Za-z][A-Za-z0-9 &'()\/-]{0,79})\s*(?:=|:)\s*(\d+(?:\.\d+)?)\s*%?/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(message)) !== null) {
      const label = match[1].trim().replace(/[.,;:]$/, '');
      const value = Number(match[2]);
      if (label && Number.isFinite(value) && value >= 0) {
        entries.push({ label, value });
      }
    }

    if (entries.length < 2) return null;

    return {
      title: 'Pie Chart',
      labels: entries.map((entry) => entry.label),
      values: entries.map((entry) => entry.value),
    };
  }

  private buildLiteralPieChartResponse(spec: LiteralPieChartSpec): string {
    return [
      'Here is the pie chart from the values you provided:',
      '',
      this.graphBlock({
        schemaVersion: 1,
        type: 'pie',
        title: spec.title,
        labels: spec.labels,
        values: spec.values,
      }),
    ].join('\n');
  }

  private graphBlock(spec: Record<string, unknown>): string {
    return ['```graph', JSON.stringify(spec, null, 2), '```'].join('\n');
  }

  private getWeekLabel(date: Date): string {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() - day + 1);
    return utc.toISOString().slice(0, 10);
  }

  private getMonthLabel(date: Date): string {
    return date.toISOString().slice(0, 7);
  }

  private incrementCount(map: Map<string, number>, key: string, amount = 1): void {
    map.set(key, (map.get(key) ?? 0) + amount);
  }

  private entriesToLabelsAndValues(
    map: Map<string, number>,
    limit?: number,
    emptyLabel = 'No records',
    sortBy: 'label' | 'valueDesc' = 'label',
  ): { labels: string[]; values: number[]; isEmpty: boolean } {
    const entries = Array.from(map.entries()).sort(([aLabel, aValue], [bLabel, bValue]) => {
      if (sortBy === 'valueDesc') {
        return bValue - aValue || aLabel.localeCompare(bLabel);
      }
      return aLabel.localeCompare(bLabel);
    });
    const selected = typeof limit === 'number'
      ? sortBy === 'valueDesc' ? entries.slice(0, limit) : entries.slice(-limit)
      : entries;

    if (selected.length === 0) {
      return { labels: [emptyLabel], values: [0], isEmpty: true };
    }

    return {
      labels: selected.map(([label]) => label),
      values: selected.map(([, value]) => value),
      isEmpty: false,
    };
  }

  private emptyChartNote(metric: string, isEmpty: boolean): string {
    return isEmpty ? `No ${metric} records were found, so the chart shows a zero-record state.` : '';
  }

  private async buildAdminAnalyticsDashboardResponse(): Promise<string> {
    const now = new Date();
    const [borrows, reservations, overdueBorrows, finePayments] = await Promise.all([
      this.prisma.borrow.findMany({
        include: {
          user: {
            select: {
              faculty: { select: { name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.reservation.findMany({
        select: { createdAt: true },
      }),
      this.prisma.borrow.findMany({
        where: {
          OR: [
            { status: BorrowStatus.OVERDUE },
            { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
          ],
        },
        select: { dueAt: true },
      }),
      this.prisma.finePayment.findMany({
        where: { status: FineStatus.PAID, paidAt: { not: null } },
        select: { amount: true, paidAt: true },
      }),
    ]);

    const borrowedByFaculty = new Map<string, number>();
    for (const borrow of borrows) {
      const faculty = borrow.user.faculty;
      this.incrementCount(borrowedByFaculty, faculty?.name ?? faculty?.code ?? 'Unassigned');
    }

    const reservationsByWeek = new Map<string, number>();
    for (const reservation of reservations) {
      this.incrementCount(reservationsByWeek, this.getWeekLabel(reservation.createdAt));
    }

    const overdueByWeek = new Map<string, number>();
    for (const borrow of overdueBorrows) {
      this.incrementCount(overdueByWeek, this.getWeekLabel(borrow.dueAt));
    }

    const finePaymentsByMonth = new Map<string, number>();
    for (const payment of finePayments) {
      if (payment.paidAt) {
        this.incrementCount(finePaymentsByMonth, this.getMonthLabel(payment.paidAt), Number(payment.amount));
      }
    }

    const borrowed = this.entriesToLabelsAndValues(borrowedByFaculty);
    const reservationsWeekly = this.entriesToLabelsAndValues(reservationsByWeek, 12);
    const overdueWeekly = this.entriesToLabelsAndValues(overdueByWeek, 12);
    const finesMonthly = this.entriesToLabelsAndValues(finePaymentsByMonth, 12);

    return [
      '## Admin Analytics Dashboard',
      '',
      'These charts use live library database records available to administrators. Empty charts mean there are no matching records for that metric.',
      '',
      '### Borrowed Books by Faculty',
      '',
      this.emptyChartNote('borrowed-book faculty', borrowed.isEmpty),
      '',
      this.graphBlock({
        schemaVersion: 1,
        type: 'bar',
        title: 'Borrowed Books by Faculty',
        labels: borrowed.labels,
        values: borrowed.values,
        xLabel: 'Faculty',
        yLabel: 'Borrow count',
      }),
      '',
      '### Reservations per Week',
      '',
      this.emptyChartNote('reservation', reservationsWeekly.isEmpty),
      '',
      this.graphBlock({
        schemaVersion: 1,
        type: 'bar',
        title: 'Reservations per Week',
        labels: reservationsWeekly.labels,
        values: reservationsWeekly.values,
        xLabel: 'Week starting',
        yLabel: 'Reservations',
      }),
      '',
      '### Overdue Books Trend',
      '',
      this.emptyChartNote('overdue borrow', overdueWeekly.isEmpty),
      '',
      this.graphBlock({
        schemaVersion: 1,
        type: 'bar',
        title: 'Overdue Books by Due Week',
        labels: overdueWeekly.labels,
        values: overdueWeekly.values,
        xLabel: 'Due week starting',
        yLabel: 'Overdue borrows',
      }),
      '',
      '### Fine Payments by Month',
      '',
      this.emptyChartNote('paid fine', finesMonthly.isEmpty),
      '',
      this.graphBlock({
        schemaVersion: 1,
        type: 'bar',
        title: 'Fine Payments by Month',
        labels: finesMonthly.labels,
        values: finesMonthly.values,
        xLabel: 'Month',
        yLabel: 'Amount paid',
      }),
    ].join('\n');
  }

  private async buildMostBorrowedCategoryDashboardResponse(limit = 12, chartType: 'bar' | 'pie' = 'bar'): Promise<string> {
    const borrows = await this.prisma.borrow.findMany({
      include: {
        bookCopy: {
          include: {
            book: { select: { category: true } },
          },
        },
      },
    });

    const categories = new Map<string, number>();
    for (const borrow of borrows) {
      this.incrementCount(categories, borrow.bookCopy.book.category ?? 'Uncategorized');
    }

    const chart = this.entriesToLabelsAndValues(categories, limit, 'No borrowed categories', 'valueDesc');

    const graphSpec: Record<string, unknown> = {
      schemaVersion: 1,
      type: chartType,
      title: 'Most Borrowed Book Categories',
      labels: chart.labels,
      values: chart.values,
    };
    if (chartType === 'bar') {
      graphSpec.xLabel = 'Category';
      graphSpec.yLabel = 'Borrow count';
    }

    return [
      '## Most Borrowed Book Categories',
      '',
      'This chart uses live borrow records grouped by each book category.',
      '',
      this.emptyChartNote('borrowed category', chart.isEmpty),
      '',
      this.graphBlock(graphSpec),
    ].join('\n');
  }

  private async buildMostBorrowedBooksDashboardResponse(limit = 12, chartType: 'bar' | 'pie' = 'bar'): Promise<string> {
    const borrows = await this.prisma.borrow.findMany({
      include: {
        bookCopy: {
          include: {
            book: { select: { title: true } },
          },
        },
      },
    });

    const books = new Map<string, number>();
    for (const borrow of borrows) {
      this.incrementCount(books, borrow.bookCopy.book.title);
    }

    const chart = this.entriesToLabelsAndValues(books, limit, 'No borrowed books', 'valueDesc');
    const maxBorrowCount = chart.isEmpty ? 0 : Math.max(...chart.values);
    const topTitles = chart.labels.filter((_, index) => chart.values[index] === maxBorrowCount && maxBorrowCount > 0);

    const graphSpec: Record<string, unknown> = {
      schemaVersion: 1,
      type: chartType,
      title: 'Most Borrowed Books',
      labels: chart.labels,
      values: chart.values,
    };
    if (chartType === 'bar') {
      graphSpec.xLabel = 'Book title';
      graphSpec.yLabel = 'Borrow count';
    }

    return [
      '## Most Borrowed Books',
      '',
      'This chart uses live borrow records grouped by exact book title.',
      '',
      chart.isEmpty
        ? this.emptyChartNote('borrowed book', true)
        : `Most borrowed title${topTitles.length === 1 ? '' : 's'}: ${topTitles.map((title) => `**${title}**`).join(', ')} (${maxBorrowCount} borrow${maxBorrowCount === 1 ? '' : 's'}).`,
      '',
      this.graphBlock(graphSpec),
    ].join('\n');
  }

  private detectFullRecall(message: string): boolean {
    return (
      /what (have|did) we (discuss|talk|cover|do)/i.test(message) ||
      /recall (this|the|our|full|entire) (chat|session|conversation|history)/i.test(message) ||
      /summarize (the|this|our|full|entire) (session|chat|conversation|history)/i.test(message) ||
      /show (me |us )?(the |our )?(full |entire |all |complete )?(chat|session|conversation) history/i.test(message) ||
      /what did (we|i) (do|discuss|cover|say|ask) (so far|in this|today)/i.test(message) ||
      /show (earlier|previous|past) discussion/i.test(message)
    );
  }

  private formatMessagesForRecall(messages: { role: string; content: string }[]): string {
    return messages
      .map((m) => `${m.role === 'user' ? 'User' : 'OZ'}: ${m.content}`)
      .join('\n');
  }

  private async getRecentConversationMessages(
    userId: string,
    conversationId: string,
  ): Promise<ConversationMemoryMessage[]> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { userId, conversationId },
      orderBy: { createdAt: 'desc' },
      take: AgentService.MEMORY_RECALL_LIMITS.recentContextMessages,
      select: { role: true, content: true },
    });

    return rows.reverse();
  }

  private async getRecallMessagesForConversation(
    userId: string,
    conversationId: string,
  ): Promise<{
    messages: ConversationMemoryMessage[];
    totalCount: number;
    truncated: boolean;
  }> {
    const totalCount = await this.prisma.aiMessage.count({
      where: { userId, conversationId },
    });

    const rows = await this.prisma.aiMessage.findMany({
      where: { userId, conversationId },
      orderBy: { createdAt: 'desc' },
      take: AgentService.MEMORY_RECALL_LIMITS.maxMessagesProcessedPerRecall,
      select: { role: true, content: true },
    });

    const messages = rows.reverse();

    return {
      messages,
      totalCount,
      truncated: totalCount > messages.length,
    };
  }

  private async completeRecallPrompt(args: {
    userId: string;
    conversationId?: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens: number;
    fallbackText: string;
  }): Promise<string> {
    try {
      const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          stream: false,
          max_tokens: args.maxTokens,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`Recall completion failed (${res.status}): ${errText}`);
        return AgentService.FINAL_PROVIDER_FAILURE_MESSAGES[res.status] ?? args.fallbackText;
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      this.tokenTrackerService.record(args.userId, args.conversationId, {
        provider: 'openrouter',
        model: args.model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      });

      return data.choices[0]?.message?.content?.trim() || args.fallbackText;
    } catch (err) {
      this.logger.warn(`Recall completion error: ${String(err)}`);
      return args.fallbackText;
    }
  }

  private detectResponseIntent(message: string): ResponseIntent {
    const lower = message.toLowerCase();
    if (/explain|summarize|describe|analyze|analyse|elaborate|break.?down|why is/.test(lower)) {
      return 'elaborate';
    }
    if (/write|generate|create|implement|format|give me a list|bullet|steps|table/.test(lower)) {
      return 'structured';
    }
    return 'concise';
  }

  // ── Conversations ──────────────────────────────────────────────

  private buildConversationModeState(conversation: {
    studyBookId?: string | null;
    manualModes?: string[];
    lastAutoModes?: string[];
  }): AiModeState {
    return buildAiModeState({
      manualModes: conversation.manualModes ?? [],
      lastAutoModes: conversation.lastAutoModes ?? [],
      isStudySession: !!conversation.studyBookId,
    });
  }

  private normalizeManualModel(model?: string | null): string | null {
    if (!model || model === AUTO_MODEL_ID) return null;
    return isAllowlistedModel(model) ? model : null;
  }

  private buildConversationModelState(conversation: {
    manualModel?: string | null;
    lastResolvedModel?: string | null;
    lastModelSelectionSource?: string | null;
  }): ConversationModelState {
    const manualModel = this.normalizeManualModel(conversation.manualModel);
    const lastResolvedModel = conversation.lastResolvedModel ?? null;
    const lastModelSelectionSource = (conversation.lastModelSelectionSource as ModelSelectionSource | null) ?? null;

    return {
      manualModel,
      lastResolvedModel,
      lastModelSelectionSource,
      activeModel: lastResolvedModel ?? manualModel,
      reason: null,
    };
  }

  private resolveModelSelection(
    message: string,
    hasImage: boolean,
    manualModel?: string | null,
    isStudySession?: boolean,
  ): ConversationModelState {
    const normalizedManualModel = this.normalizeManualModel(manualModel);
    const requiresTools = !hasImage && !this.isSimpleMessage(message);
    const requiresImage = hasImage;

    if (normalizedManualModel) {
      const entry = getModelEntry(normalizedManualModel);
      if (requiresImage && entry && !entry.capabilities.supportsImages) {
        this.logFallback(normalizedManualModel, OPENROUTER_MODELS.CHEAP, 'capability_fallback', 'image_required');
        return {
          manualModel: normalizedManualModel,
          lastResolvedModel: OPENROUTER_MODELS.CHEAP,
          lastModelSelectionSource: 'capability_fallback',
          activeModel: OPENROUTER_MODELS.CHEAP,
          reason: 'image_required',
        };
      }
      if (requiresTools && entry && !entry.capabilities.supportsTools) {
        this.logFallback(normalizedManualModel, OPENROUTER_MODELS.CHEAP, 'capability_fallback', 'tools_required');
        return {
          manualModel: normalizedManualModel,
          lastResolvedModel: OPENROUTER_MODELS.CHEAP,
          lastModelSelectionSource: 'capability_fallback',
          activeModel: OPENROUTER_MODELS.CHEAP,
          reason: 'tools_required',
        };
      }
      return {
        manualModel: normalizedManualModel,
        lastResolvedModel: normalizedManualModel,
        lastModelSelectionSource: 'manual',
        activeModel: normalizedManualModel,
        reason: 'manual_override',
      };
    }

    // Auto mode
    let resolvedModel: string = OPENROUTER_MODELS.CHEAP;
    let reason = 'default_tools';

    if (hasImage && this.isTechnicalOrScientificQuery(message)) {
      resolvedModel = OPENROUTER_MODELS.TECHNICAL;
      reason = 'technical_image';
    } else if (hasImage) {
      resolvedModel = OPENROUTER_MODELS.CHEAP;
      reason = 'image';
    } else if (this.isTechnicalOrScientificQuery(message)) {
      resolvedModel = OPENROUTER_MODELS.TECHNICAL;
      reason = 'technical_scientific_query';
    } else if (isStudySession || this.isDeepQuery(message)) {
      resolvedModel = OPENROUTER_MODELS.SMART;
      reason = isStudySession ? 'study_session' : 'deep_query';
    } else if (this.isSimpleMessage(message)) {
      resolvedModel = OPENROUTER_MODELS.FREE;
      reason = 'simple_query';
    }

    return {
      manualModel: null,
      lastResolvedModel: resolvedModel,
      lastModelSelectionSource: 'auto',
      activeModel: resolvedModel,
      reason,
    };
  }

  private logFallback(
    preferred: string,
    actual: string,
    source: Extract<ModelSelectionSource, 'capability_fallback' | 'rate_limit_fallback'>,
    reason: string,
  ): void {
    this.logger.warn(
      `[model-fallback] preferred=${preferred} actual=${actual} source=${source} reason=${reason}`,
    );
  }

  private serializeConversation(conversation: {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    studyBookId?: string | null;
    manualModes?: string[];
    lastAutoModes?: string[];
    manualModel?: string | null;
    lastResolvedModel?: string | null;
    lastModelSelectionSource?: string | null;
  }) {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      studyBookId: conversation.studyBookId ?? null,
      ...this.buildConversationModeState(conversation),
      ...this.buildConversationModelState(conversation),
    };
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        studyBookId: true,
        manualModes: true,
        lastAutoModes: true,
        manualModel: true,
        lastResolvedModel: true,
        lastModelSelectionSource: true,
      },
    });

    return conversations.map((conversation) => this.serializeConversation(conversation));
  }

  async createConversation(userId: string) {
    const conversation = await this.prisma.aiConversation.create({
      data: { userId, title: 'New Chat' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        studyBookId: true,
        manualModes: true,
        lastAutoModes: true,
        manualModel: true,
        lastResolvedModel: true,
        lastModelSelectionSource: true,
      },
    });

    return this.serializeConversation(conversation);
  }

  async deleteConversation(id: string, userId: string) {
    await this.prisma.aiConversation.deleteMany({ where: { id, userId } });
  }

  async conversationBelongsToUser(conversationId: string, userId: string): Promise<boolean> {
    const conv = await this.prisma.aiConversation.findFirst({ where: { id: conversationId, userId } });
    return conv !== null;
  }

  // ── History ────────────────────────────────────────────────────

  async getHistory(userId: string, conversationId?: string) {
    return this.prisma.aiMessage.findMany({
      where: conversationId ? { userId, conversationId } : { userId, conversationId: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async saveMessage(userId: string, role: string, content: string, conversationId?: string) {
    return this.prisma.aiMessage.create({
      data: { userId, role, content, ...(conversationId ? { conversationId } : {}) },
    });
  }

  // ── Study sessions ─────────────────────────────────────────────

  async createStudySession(
    userId: string,
    bookId: string,
    requestedManualModes?: string[] | string,
  ): Promise<{ conversationId: string; openingMessage: string }> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        title: true,
        authors: true,
        description: true,
        category: true,
        subjectTags: true,
        publicationYear: true,
        publisher: true,
        pageCount: true,
        isEbookAvailable: true,
      },
    });

    if (!book) {
      throw new NotFoundException(`Book ${bookId} not found`);
    }

    const conv = await this.prisma.aiConversation.create({
      data: {
        userId,
        title: `Study: ${book.title.slice(0, 50)}`,
        studyBookId: bookId,
        manualModes: normalizeAiModes(requestedManualModes),
        lastAutoModes: getDefaultAutoModes(true),
        manualModel: null,
        lastResolvedModel: OPENROUTER_MODELS.STUDY,
        lastModelSelectionSource: 'auto',
      },
    });

    const authorsStr = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors ?? '');
    const subjectTagsStr = Array.isArray(book.subjectTags) && book.subjectTags.length > 0
      ? book.subjectTags.join(', ')
      : 'none';
    const publisherSuffix = book.publisher ? `by ${book.publisher}` : '';

    const studyPrompt = `You are a university library study assistant. A student has opened a dedicated study session for this book.

Title: ${book.title}
Authors: ${authorsStr}
Category: ${book.category ?? 'Not specified'}
Subject tags: ${subjectTagsStr}
Description: ${book.description ?? 'No description available'}
Published: ${book.publicationYear ?? 'Unknown'} ${publisherSuffix}
Pages: ${book.pageCount ?? 'Unknown'}
E-book available: ${book.isEbookAvailable ? 'Yes' : 'No'}

Write a structured study guide in markdown covering:
1. **What this book is about** (2–3 sentences)
2. **Who it is best suited for and why**
3. **How to approach reading it** (strategy, order, pace)
4. **5 key concepts or themes to watch for**
5. **3 guiding questions to keep in mind while reading**

Be concise, practical, and encouraging. Base everything on the book details provided above. Do not invent content beyond what is given.`;

    let studyGuide = '';
    try {
      const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
        body: JSON.stringify({
          model: OPENROUTER_MODELS.STUDY,
          messages: [{ role: 'user', content: studyPrompt }],
          max_tokens: this.studyGuideMaxTokens,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`Study guide generation failed (${res.status}): ${errText} — using rule-based fallback`);
      } else {
        const data = await res.json() as { choices: Array<{ message: { content: string | null } }> };
        studyGuide = data.choices[0]?.message?.content ?? '';
      }
    } catch (err) {
      this.logger.warn(`Study guide LLM error: ${String(err)} — using rule-based fallback`);
    }

    if (!studyGuide) {
      studyGuide = `## 📖 Study Guide: ${book.title}\n\n` +
        `**Authors:** ${authorsStr || 'Unknown'}\n` +
        (book.category ? `**Category:** ${book.category}\n` : '') +
        (book.description ? `\n${book.description}\n` : '') +
        `\n### How to approach this book\n` +
        `Start with the table of contents to get a map of the material, then read chapter by chapter taking notes on key terms and arguments. Return to chapters that introduce new concepts.\n\n` +
        `### Key questions to keep in mind\n` +
        `1. What is the central argument or purpose of this book?\n` +
        `2. What evidence or examples does the author use to support their points?\n` +
        `3. How does this connect to what you already know about the subject?\n\n` +
        `Ask me anything about this book to deepen your understanding.`;
    }

    await this.saveMessage(userId, 'assistant', studyGuide, conv.id);

    return { conversationId: conv.id, openingMessage: studyGuide };
  }

  async createMaterialStudySession(
    userId: string,
    userRole: Role,
    materialId: string,
    requestedManualModes?: string[] | string,
  ): Promise<{ conversationId: string; openingMessage: string }> {
    const accessContext = await this.materialSearch.getAccessContextForUser(userId, userRole);
    const material = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        isApproved: true,
        isPublished: true,
        indexStatus: IndexStatus.INDEXED,
        ...buildMaterialAccessWhere(accessContext),
      },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        authorName: true,
        keywords: true,
        facultyCode: true,
        courseCode: true,
        year: true,
      },
    });

    if (!material) {
      throw new NotFoundException(`Material ${materialId} not found`);
    }

    const outline = await this.materialSearch.getMaterialOutline(materialId, accessContext);
    if (!outline.length) {
      throw new NotFoundException(`Indexed content for material ${materialId} not found`);
    }

    const conv = await this.prisma.aiConversation.create({
      data: {
        userId,
        title: `Study: ${material.title.slice(0, 50)}`,
        manualModes: normalizeAiModes(requestedManualModes),
        lastAutoModes: getDefaultAutoModes(true),
        manualModel: null,
        lastResolvedModel: OPENROUTER_MODELS.STUDY,
        lastModelSelectionSource: 'auto',
      },
    });

    const keywordText = Array.isArray(material.keywords) && material.keywords.length > 0
      ? material.keywords.join(', ')
      : 'none';
    const outlineText = outline.map((chunk) =>
      `[Chunk ${chunk.chunkIndex}${chunk.pageNumber != null ? `, page ${chunk.pageNumber}` : ''}]\n${chunk.content}`,
    ).join('\n\n---\n\n');

    const studyPrompt = `You are a university library study assistant. A user has opened a dedicated study session for this indexed academic material.

Title: ${material.title}
Type: ${material.type}
Author: ${material.authorName}
Year: ${material.year ?? 'Unknown'}
Faculty: ${material.facultyCode ?? 'Not specified'}
Course: ${material.courseCode ?? 'Not specified'}
Keywords: ${keywordText}
Description: ${material.description ?? 'No description available'}

Opening indexed content:
${outlineText}

Write a structured study guide in markdown covering:
1. **Material summary** based on the indexed content
2. **Main topics or arguments**
3. **How to study this material** with practical reading steps
4. **5 key terms, ideas, or sections to focus on**
5. **3 guiding questions for deeper understanding**
6. **What the user can ask OZ next**

Be concise, accurate, and educational. Base the guide only on the material metadata and indexed content above. Do not claim to have read sections that are not represented in the indexed content.`;

    let studyGuide = '';
    try {
      const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
        body: JSON.stringify({
          model: OPENROUTER_MODELS.STUDY,
          messages: [{ role: 'user', content: studyPrompt }],
          max_tokens: this.studyGuideMaxTokens,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`Material study guide generation failed (${res.status}): ${errText} — using rule-based fallback`);
      } else {
        const data = await res.json() as { choices: Array<{ message: { content: string | null } }> };
        studyGuide = data.choices[0]?.message?.content ?? '';
      }
    } catch (err) {
      this.logger.warn(`Material study guide LLM error: ${String(err)} — using rule-based fallback`);
    }

    if (!studyGuide) {
      const preview = outline[0]?.content ?? material.description ?? '';
      studyGuide = `## Study Guide: ${material.title}\n\n` +
        `**Type:** ${material.type}\n` +
        `**Author:** ${material.authorName}\n` +
        (material.description ? `\n${material.description}\n` : '') +
        `\n### Material summary\n\n` +
        `${preview}\n\n` +
        `### How to study this material\n\n` +
        `1. Start by reading the opening section carefully and note the central topic.\n` +
        `2. Identify recurring terms, definitions, and examples.\n` +
        `3. Turn each major section into a short question and answer it in your own words.\n\n` +
        `### Guiding questions\n\n` +
        `1. What problem or topic is this material focused on?\n` +
        `2. Which concepts are most important for a course discussion or exam?\n` +
        `3. What examples or evidence does the author use?\n\n` +
        `Ask me to explain a section, create quiz questions, build flashcards, or make a study plan for this material.`;
    }

    await this.saveMessage(userId, 'assistant', studyGuide, conv.id);

    return { conversationId: conv.id, openingMessage: studyGuide };
  }

  async updateConversationMode(id: string, userId: string, requestedManualModes?: string[] | string): Promise<void> {
    await this.prisma.aiConversation.updateMany({
      where: { id, userId },
      data: { manualModes: normalizeAiModes(requestedManualModes) },
    });
  }

  async updateConversationModel(id: string, userId: string, model: string): Promise<void> {
    const manualModel = model === AUTO_MODEL_ID ? null : model;
    const result = await this.prisma.aiConversation.updateMany({
      where: { id, userId },
      data: { manualModel },
    });
    if (result.count === 0) {
      throw new NotFoundException('Conversation not found');
    }
  }

  getAvailableModels() {
    return getPublicModelList();
  }
  // ── Tools ──────────────────────────────────────────────────────

  private getTools(userRole?: Role): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    const tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> = [
      {
        type: 'function',
        function: {
          name: 'search_catalog',
          description: 'Search the library catalog by title, author, subject or keyword. Always call this before recommending a book.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term' },
              pageSize: { type: 'number', description: 'default 5, max 10' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_book_details',
          description: 'Get full details for a specific book including availability and e-book link.',
          parameters: {
            type: 'object',
            properties: { bookId: { type: 'string', description: 'Book ID from search results' } },
            required: ['bookId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_ebook',
          description: 'Read a managed e-book or uploaded book PDF from its URL. Use this for summaries, explanations, quotes, chapter lists, table of contents, or book structure questions.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'E-book URL' },
              question: { type: 'string', description: 'What to find in the book' },
            },
            required: ['url', 'question'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_webpage',
          description: 'Fetch any public URL to look up information.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to fetch' },
              purpose: { type: 'string', description: 'What to look for' },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_my_borrows',
          description: "Get the current user's own active borrows and due dates.",
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_catalog_stats',
          description: 'Get total book count, copy counts, and e-book count from the library catalog.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_active_borrows',
          description: 'Get all currently active borrows across the library and the top 5 most-borrowed books.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_active_reservations',
          description: 'Get all active (pending or ready for pickup) reservations in the library.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_stats',
          description: 'Get total registered user counts broken down by role (STUDENT, FACULTY, ADMIN).',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_reading_lists',
          description: 'Get published reading lists from the library. Returns title, description, course code, semester, instructor name, and the books in each list. Use this when a user asks to see reading lists, browse course lists, or find what books instructors recommend.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max number of lists to return (default 10, max 20)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_my_reading_lists',
          description: "Get the current instructor's own reading lists including drafts. Use when an instructor asks about their own lists, or wants to manage or review what they have created.",
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_study_material',
          description: 'Full-text search across all indexed study materials (research papers, lecture notes, theses, etc.) uploaded by instructors. Use when the user asks about a topic covered in course materials.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query — keywords, concepts, or phrases' },
              limit: { type: 'number', description: 'Max results to return (1–10, default 5)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_study_materials',
          description: 'List all study materials that have been indexed and are available for AI reading. Returns titles, types, authors, and chunk counts.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_chunk_context',
          description: 'Retrieve surrounding context (neighbouring chunks) for a specific chunk to get more complete information on a topic.',
          parameters: {
            type: 'object',
            properties: {
              materialId: { type: 'string', description: 'The material ID' },
              chunkIndex: { type: 'number', description: 'The chunk index to expand context around' },
            },
            required: ['materialId', 'chunkIndex'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_material_outline',
          description: 'Get the opening outline (first few chunks) of a study material to understand its structure and main topics. Only use this for indexed study materials, never for library books.',
          parameters: {
            type: 'object',
            properties: {
              materialId: { type: 'string', description: 'The material ID' },
            },
            required: ['materialId'],
          },
        },
      },
      ...(this.pythonExecution.isAvailable() ? [{
        type: 'function' as const,
        function: {
          name: 'run_python',
          description: 'Run bounded Python for scientific calculations, symbolic math, numerical methods, matrices, statistics, dataframe work, and graph data. Never use this for live library catalog data.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Python code to execute' },
              purpose: { type: 'string', description: 'Why this calculation is needed' },
            },
            required: ['code', 'purpose'],
          },
        },
      }] : []),
    ];

    // Admin-only analytics tools — only passed to the model when the user is an ADMIN
    if (userRole === Role.ADMIN) {
      tools.push(
        {
          type: 'function',
          function: {
            name: 'get_most_borrowed_books',
            description:
              'Returns a chart showing which books have been borrowed the most times, ranked by borrow count. Use when the user asks about popular books, most borrowed titles, or borrowing statistics.',
            parameters: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of books to show, default 12' },
                chartType: { type: 'string', enum: ['bar', 'pie'], description: 'Chart type to render, default bar. Use pie when the user asks for a pie chart.' },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_most_borrowed_categories',
            description:
              'Returns a chart showing which book categories, genres, subject areas, topics, or disciplines are borrowed most, grouped by category. Use when the user asks about popular categories, genres, subject areas, borrowing trends by topic, which fields of study are most popular, or what subjects students read most.',
            parameters: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of categories to show, default 12' },
                chartType: { type: 'string', enum: ['bar', 'pie'], description: 'Chart type to render, default bar. Use pie when the user asks for a pie chart.' },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_admin_analytics',
            description:
              'Returns the full admin analytics dashboard: active borrows, overdue count, fine totals, pending reservations, and borrow trends. Use when the user asks for general library statistics or an overview.',
            parameters: { type: 'object', properties: {} },
          },
        },
      );
    }

    return tools;
  }

  // ── Tool execution ─────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    userRole: Role,
    cookieHeader: string,
  ): Promise<{ result: string; citations: BookCitation[] }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    };

    const hookContext: ToolExecutionContext = {
      toolName: name,
      arguments: args,
      userId,
      userRole,
      timestamp: new Date(),
    };

    const startTime = Date.now();
    try { await this.toolHookService.runPreHook(hookContext); } catch { /* hooks must not break execution */ }

    try {
      const toolResult = await this.executeToolInner(name, args, userId, userRole, cookieHeader, headers);
      try {
        await this.toolHookService.runPostHook(hookContext, {
          success: true,
          data: toolResult.result,
          executionTimeMs: Date.now() - startTime,
        });
      } catch { /* hooks must not break execution */ }
      return toolResult;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      try { await this.toolHookService.runErrorHook(hookContext, error); } catch { /* hooks must not break execution */ }
      this.logger.warn(`Tool ${name} failed: ${error.message}`);
      return { result: `Tool error: ${error.message}`, citations: [] };
    }
  }

  /** Block localhost, RFC-1918, link-local, and the local API to prevent SSRF. */
  private assertSafeUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http and https URLs are allowed');
    }
    const host = parsed.hostname.toLowerCase();
    const blocked = /^(localhost|127\.|::1$|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host);
    if (blocked) {
      throw new Error(`Blocked URL: requests to internal addresses are not allowed`);
    }
  }


  private isPdfLikeUrl(url: string): boolean {
    return url.split('?')[0].toLowerCase().endsWith('.pdf');
  }

  private tokenizeExcerptTerms(question: string): string[] {
    const stopWords = new Set([
      'about', 'book', 'does', 'from', 'have', 'into', 'that', 'this', 'what', 'when',
      'where', 'which', 'with', 'would', 'could', 'should', 'there', 'their', 'them',
      'your', 'please', 'explain', 'summarize', 'summary', 'topic', 'requested',
    ]);

    return Array.from(
      new Set((question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((term) => !stopWords.has(term))),
    ).slice(0, 10);
  }

  private buildRelevantExcerpt(text: string, question: string, maxChars = 4000): string {
    const normalized = text.replace(/\f/g, '\n\n').replace(/\r/g, '').trim();
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;

    const blocks = normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    if (blocks.length === 0) {
      return normalized.slice(0, maxChars) + '\n\n[Excerpt from a longer document]';
    }

    const terms = this.tokenizeExcerptTerms(question);
    const scored = blocks.map((block, index) => {
      const lower = block.toLowerCase();
      const score = terms.reduce((sum, term) => sum + Math.max(lower.split(term).length - 1, 0), 0) + (index < 2 ? 0.25 : 0);
      return { block, index, score };
    });

    const ranked = scored.some((entry) => entry.score > 0)
      ? scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
      : scored.slice(0, 3);

    const chosen = ranked.slice(0, 3).sort((a, b) => a.index - b.index);
    let excerpt = '';

    for (const item of chosen) {
      const candidate = excerpt ? `${excerpt}\n\n${item.block}` : item.block;
      if (candidate.length > maxChars) {
        break;
      }
      excerpt = candidate;
    }

    if (!excerpt) {
      excerpt = normalized.slice(0, maxChars);
    }

    return excerpt.length < normalized.length
      ? `${excerpt}\n\n[Excerpt from a longer document]`
      : excerpt;
  }

  private isStructureQuestion(question: string): boolean {
    return /(table of contents|contents|chapter|chapters|part\b|parts\b|outline|structure|section|sections)/i.test(question);
  }

  private buildStructureExcerpt(text: string, maxChars = 5000): string {
    const normalized = text.replace(/\r/g, '').replace(/\f/g, '\n');
    const tableOfContentsMatch = normalized.match(/(?:^|\n)(table of contents|contents)(?:\n|\s)/i);

    if (tableOfContentsMatch?.index != null) {
      const start = tableOfContentsMatch.index;
      return normalized.slice(start, start + maxChars).trim();
    }

    const lines = normalized
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const structureLines = lines.filter((line) => /^(part|chapter)\b/i.test(line) || /\bchapter\b/i.test(line));
    if (structureLines.length > 0) {
      return structureLines.slice(0, 80).join('\n');
    }

    return normalized.slice(0, maxChars).trim();
  }

  private formatReadableBookContent(content: BookPdfContent, question: string): string {
    const metadata = [
      content.title ? `Title: ${content.title}` : null,
      content.authors.length > 0 ? `Authors: ${content.authors.join(', ')}` : null,
      content.category ? `Category: ${content.category}` : null,
      content.publicationYear ? `Year: ${content.publicationYear}` : null,
      content.publisher ? `Publisher: ${content.publisher}` : null,
      content.pageCount ? `Pages: ${content.pageCount}` : null,
      content.description ? `Description: ${content.description}` : null,
    ].filter((line): line is string => Boolean(line));

    const excerpt = this.isStructureQuestion(question)
      ? this.buildStructureExcerpt(content.text, 5000)
      : this.buildRelevantExcerpt(content.text, question, 4000);

    const heading = this.isStructureQuestion(question) ? 'BOOK STRUCTURE' : 'E-BOOK CONTENT';
    return `${heading} (for: ${question}):\n\n${metadata.join('\n')}${metadata.length > 0 ? '\n\n' : ''}${excerpt}`;
  }
  private async executeToolInner(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    userRole: Role,
    cookieHeader: string,
    headers: Record<string, string>,
  ): Promise<{ result: string; citations: BookCitation[] }> {
    const API_BASE = 'http://localhost:3001';

    switch (name) {
        case 'search_catalog': {
          const pageSize = Math.min((args.pageSize as number) || 5, 10);
          const searchResult = await this.catalogSearch.searchForAgent(args.query as string, pageSize);
          if (searchResult.total === 0) {
            return { result: 'No books found for that search.', citations: [] };
          }
          const citations: BookCitation[] = searchResult.results.map((b) => ({
            title: b.title,
            catalogLink: b.catalogLink,
            available: b.available,
            copies: b.copies,
          }));
          return {
            result: this.catalogSearch.formatSearchResults(searchResult),
            citations,
          };
        }

        case 'get_book_details': {
          const res = await fetch(`${API_BASE}/books/${args.bookId as string}`, { headers });
          if (!res.ok) return { result: 'Book not found.', citations: [] };
          const book = await res.json() as Record<string, unknown>;
          return {
            result: JSON.stringify({
              id: book.id, title: book.title, authors: book.authors,
              description: book.description, publisher: book.publisher,
              year: book.publicationYear, pages: book.pageCount,
              isbn: book.isbn, language: book.language,
              isEbook: book.isEbookAvailable, ebookUrl: book.ebookUrl ?? null,
              pdfUrl: book.pdfUrl ?? null,
              readUrl: (book.pdfUrl ?? book.ebookUrl) ?? null,
              availableCopies: book.availableCopies, totalCopies: book.totalCopies,
              isAvailable: book.isAvailable, subjects: book.subjectTags,
              catalogLink: `/dashboard/catalog/${book.id}`,
            }),
            citations: [],
          };
        }

        case 'read_ebook': {
          const url = args.url as string;
          const question = (args.question as string) || 'the requested topic';

          if (url.startsWith('/uploads/') || this.isPdfLikeUrl(url)) {
            if (!url.startsWith('/uploads/')) {
              this.assertSafeUrl(url);
            }

            const pdfContent = await this.bookDocumentService.getPdfDocumentContent(url);
            if (pdfContent?.text) {
              return {
                result: this.formatReadableBookContent(pdfContent, question),
                citations: [],
              };
            }

            if (this.isPdfLikeUrl(url)) {
              return {
                result: 'I could not extract readable text from that PDF document.',
                citations: [],
              };
            }
          }

          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return {
              result: 'This document URL is not supported by read_ebook.',
              citations: [],
            };
          }

          this.assertSafeUrl(url);
          const res = await fetch(url, {
            headers: { 'User-Agent': 'LibraryBotAI/1.0' },
            signal: AbortSignal.timeout(15000),
          });
          const html = await res.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!text) {
            return {
              result: 'I could not extract readable text from that e-book URL.',
              citations: [],
            };
          }

          const excerpt = this.buildRelevantExcerpt(text, question, 4000);
          return { result: `E-BOOK CONTENT (for: ${question}):\n\n${excerpt}`, citations: [] };
        }

        case 'fetch_webpage': {
          this.assertSafeUrl(args.url as string);
          const res = await fetch(args.url as string, {
            headers: { 'User-Agent': 'LibraryBotAI/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          const html = await res.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000);
          return { result: `WEB PAGE (${args.url as string}):\n\n${text}`, citations: [] };
        }

        case 'get_my_borrows': {
          const borrows = await this.prisma.borrow.findMany({
            where: { userId, status: BorrowStatus.ACTIVE },
            include: { bookCopy: { include: { book: { select: { title: true } } } } },
          });
          if (!borrows.length) return { result: 'No active borrows.', citations: [] };
          const now = new Date();
          const mapped = borrows.map((b) => {
            const daysLeft = Math.ceil((new Date(b.dueAt).getTime() - now.getTime()) / 86400000);
            return { title: b.bookCopy.book.title, dueDate: b.dueAt, daysLeft, isOverdue: daysLeft < 0 };
          });
          return { result: JSON.stringify(mapped), citations: [] };
        }

        case 'get_catalog_stats': {
          const [totalBooks, totalCopies, availableCopies, borrowedCopies, ebookCount, activeborrows] =
            await Promise.all([
              this.prisma.book.count({ where: { isActive: true } }),
              this.prisma.bookCopy.count(),
              this.prisma.bookCopy.count({ where: { status: 'AVAILABLE' } }),
              this.prisma.bookCopy.count({ where: { status: 'BORROWED' } }),
              this.prisma.book.count({ where: { isEbookAvailable: true } }),
              this.prisma.borrow.count({ where: { status: 'ACTIVE' } }),
            ]);
          return {
            result: JSON.stringify({ totalBooks, totalCopies, availableCopies, borrowedCopies, ebookCount, activeBorrows: activeborrows }),
            citations: [],
          };
        }

        case 'get_active_borrows': {
          if (userRole !== 'ADMIN' && userRole !== 'STAFF') {
            return { result: 'Access denied: this tool is only available to staff and administrators.', citations: [] };
          }
          const [activeBorrows, mostBorrowed] = await Promise.all([
            this.prisma.borrow.findMany({
              where: { status: 'ACTIVE' },
              include: {
                bookCopy: { include: { book: { select: { id: true, title: true } } } },
                user: { select: { name: true, role: true } },
              },
              orderBy: { dueAt: 'asc' },
              take: 20,
            }),
            this.prisma.$queryRaw<{ title: string; borrow_count: bigint }[]>`
              SELECT b.title, COUNT(br.id) AS borrow_count
              FROM borrows br
              JOIN book_copies bc ON bc.id = br."bookCopyId"
              JOIN books b ON b.id = bc."bookId"
              GROUP BY b.id, b.title
              ORDER BY borrow_count DESC
              LIMIT 5
            `,
          ]);
          const now = new Date();
          return {
            result: JSON.stringify({
              activeBorrowCount: activeBorrows.length,
              activeBorrows: activeBorrows.map((b) => ({
                book: b.bookCopy.book.title, borrower: b.user.name, role: b.user.role,
                dueAt: b.dueAt, daysLeft: Math.ceil((new Date(b.dueAt).getTime() - now.getTime()) / 86400000),
              })),
              mostBorrowedBooks: mostBorrowed.map((r) => ({ title: r.title, borrowCount: Number(r.borrow_count) })),
            }),
            citations: [],
          };
        }

        case 'get_active_reservations': {
          if (userRole !== 'ADMIN' && userRole !== 'STAFF') {
            return { result: 'Access denied: this tool is only available to staff and administrators.', citations: [] };
          }
          const reservations = await this.prisma.reservation.findMany({
            where: { status: { in: ['PENDING', 'READY_FOR_PICKUP'] } },
            include: {
              bookCopy: { include: { book: { select: { title: true } } } },
              user: { select: { name: true } },
              branch: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
          if (!reservations.length) return { result: 'No active reservations.', citations: [] };
          return {
            result: JSON.stringify({
              count: reservations.length,
              reservations: reservations.map((r) => ({
                book: r.bookCopy.book.title, user: r.user.name, status: r.status,
                branch: r.branch.name, createdAt: r.createdAt, pickupDeadline: r.pickupDeadline,
              })),
            }),
            citations: [],
          };
        }

        case 'get_user_stats': {
          if (userRole !== 'ADMIN') {
            return { result: 'Access denied: this tool is only available to administrators.', citations: [] };
          }
          const [total, students, admins] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { role: 'STUDENT' } }),
            this.prisma.user.count({ where: { role: 'ADMIN' } }),
          ]);
          return {
            result: JSON.stringify({ totalUsers: total, students, admins }),
            citations: [],
          };
        }

        case 'get_reading_lists': {
          const limit = Math.min((args.limit as number) || 10, 20);
          const lists = await this.prisma.readingList.findMany({
            where: {
              status: 'PUBLISHED',
              isActive: true,
              visibility: { in: ['PUBLIC', 'FOLLOWERS_ONLY'] },
            },
            include: {
              owner: { select: { name: true, department: true } },
              items: {
                include: { book: { select: { title: true, authors: true } } },
                orderBy: { orderIndex: 'asc' },
              },
              _count: { select: { items: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: limit,
          });
          if (!lists.length) return { result: 'No published reading lists found.', citations: [] };
          const formatted = lists.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description ?? null,
            courseCode: l.courseCode ?? null,
            semester: l.semester ?? null,
            instructor: l.owner.name,
            department: l.owner.department ?? null,
            bookCount: l._count.items,
            books: l.items.map((i) => ({ title: i.book.title, authors: i.book.authors })),
            catalogLink: `/dashboard/reading-lists/${l.id}`,
          }));
          return { result: JSON.stringify(formatted), citations: [] };
        }

        case 'get_my_reading_lists': {
          if (userRole !== 'INSTRUCTOR' && userRole !== 'ADMIN') {
            return { result: 'This tool is only available to instructors and administrators.', citations: [] };
          }
          const myLists = await this.prisma.readingList.findMany({
            where: { ownerId: userId },
            include: {
              items: {
                include: { book: { select: { title: true, authors: true } } },
                orderBy: { orderIndex: 'asc' },
              },
              _count: { select: { items: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
          });
          if (!myLists.length) return { result: 'You have no reading lists yet.', citations: [] };
          const formatted = myLists.map((l) => ({
            id: l.id,
            title: l.title,
            status: l.status,
            visibility: l.visibility,
            courseCode: l.courseCode ?? null,
            semester: l.semester ?? null,
            bookCount: l._count.items,
            books: l.items.map((i) => ({ title: i.book.title, authors: i.book.authors })),
            catalogLink: `/dashboard/reading-lists/${l.id}`,
          }));
          return { result: JSON.stringify(formatted), citations: [] };
        }

        case 'search_study_material': {
          const limit = Math.min(Math.max((args.limit as number) || 5, 1), 10);
          const accessContext = await this.materialSearch.getAccessContextForUser(userId, userRole);
          const chunks = await this.materialSearch.searchChunks(args.query as string, accessContext, { limit });
          if (!chunks.length) return { result: 'No study materials found matching that query.', citations: [] };
          const merged = this.materialSearch.mergeAdjacentChunks(chunks);
          const formatted = merged.map((c, i) => [
            `[${i + 1}] "${c.material.title}" by ${c.material.authorName} (${c.material.type})${c.pageNumber != null ? ` — page ${c.pageNumber}` : ''}`,
            c.content,
          ].join('\n')).join('\n\n---\n\n');
          return { result: `STUDY MATERIAL SEARCH RESULTS (query: "${args.query as string}"):\n\n${formatted}`, citations: [] };
        }

        case 'list_study_materials': {
          const accessContext = await this.materialSearch.getAccessContextForUser(userId, userRole);
          const materials = await this.materialSearch.listIndexedMaterials(accessContext);
          if (!materials.length) return { result: 'No indexed study materials are available yet.', citations: [] };
          const formatted = materials.map((m) =>
            `• "${m.title}" by ${m.authorName} (${m.type}) — ${m.chunkCount} chunk${m.chunkCount !== 1 ? 's' : ''} — ID: ${m.id}`,
          ).join('\n');
          return { result: `INDEXED STUDY MATERIALS (${materials.length} total):\n\n${formatted}`, citations: [] };
        }

        case 'get_chunk_context': {
          const accessContext = await this.materialSearch.getAccessContextForUser(userId, userRole);
          const targetChunkId = await this.materialSearch.getAccessibleChunkId(
            args.materialId as string,
            args.chunkIndex as number,
            accessContext,
          );
          if (!targetChunkId) return { result: 'No context found for that chunk.', citations: [] };
          const neighbors = await this.materialSearch.getChunkNeighbors(targetChunkId, accessContext);
          if (!neighbors.length) return { result: 'No context found for that chunk.', citations: [] };
          const formatted = neighbors.map((c) =>
            `[Chunk ${c.chunkIndex}${c.pageNumber != null ? `, page ${c.pageNumber}` : ''}]\n${c.content}`,
          ).join('\n\n---\n\n');
          return { result: `CHUNK CONTEXT:\n\n${formatted}`, citations: [] };
        }

        case 'get_material_outline': {
          const accessContext = await this.materialSearch.getAccessContextForUser(userId, userRole);
          const outline = await this.materialSearch.getMaterialOutline(args.materialId as string, accessContext);
          if (!outline.length) return { result: 'No outline available for that material.', citations: [] };
          const formatted = outline.map((c) =>
            `[Chunk ${c.chunkIndex}${c.pageNumber != null ? `, page ${c.pageNumber}` : ''}]\n${c.content}`,
          ).join('\n\n---\n\n');
          return { result: `MATERIAL OUTLINE:\n\n${formatted}`, citations: [] };
        }

        case 'run_python': {
          const code = String(args.code ?? '');
          const execution = await this.pythonExecution.execute(code);
          const status = execution.ok ? 'succeeded' : 'failed';
          const parts = [
            `Python execution ${status}.`,
            execution.stdout ? `stdout:\n${execution.stdout}` : '',
            execution.stderr ? `stderr:\n${execution.stderr}` : '',
            execution.error ? `error: ${execution.error}` : '',
          ].filter(Boolean);
          return { result: parts.join('\n'), citations: [] };
        }

        case 'get_most_borrowed_books': {
          if (userRole !== Role.ADMIN) {
            return { result: 'Access denied: admin only.', citations: [] };
          }
          const limit = (args.limit as number | undefined) ?? 12;
          const chartType = (args.chartType as 'bar' | 'pie' | undefined) ?? 'bar';
          return { result: await this.buildMostBorrowedBooksDashboardResponse(limit, chartType), citations: [] };
        }

        case 'get_most_borrowed_categories': {
          if (userRole !== Role.ADMIN) {
            return { result: 'Access denied: admin only.', citations: [] };
          }
          const limit = (args.limit as number | undefined) ?? 12;
          const chartType = (args.chartType as 'bar' | 'pie' | undefined) ?? 'bar';
          return { result: await this.buildMostBorrowedCategoryDashboardResponse(limit, chartType), citations: [] };
        }

        case 'get_admin_analytics': {
          if (userRole !== Role.ADMIN) {
            return { result: 'Access denied: admin only.', citations: [] };
          }
          return { result: await this.buildAdminAnalyticsDashboardResponse(), citations: [] };
        }

        default:
          return { result: 'Unknown tool.', citations: [] };
      }
  }

  // ── Agent streaming loop ───────────────────────────────────────

  async *chatStream(
    userId: string,
    message: string,
    history: { role: string; content: string }[],
    hasImage: boolean,
    imageBase64: string | null,
    cookieHeader: string,
    conversationId?: string,
    modelOverride?: string,
    manualModesInput?: string[] | string,
  ): AsyncGenerator<ChatChunk> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        faculty: true,
        borrows: {
          where: { status: BorrowStatus.ACTIVE },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { bookCopy: { include: { book: { select: { title: true } } } } },
        },
      },
    });

    if (!user) {
      yield { type: 'text', text: 'User not found.' };
      return;
    }

    const policy = await this.prisma.borrowPolicy.findUnique({ where: { role: user.role } });

    const materialAccessContext = {
      userId: user.id,
      role: user.role,
      facultyCode: user.faculty?.code ?? null,
      courseCodes: user.courses ?? [],
    };

    const [catalogTotalBooks, catalogAvailableCopies, publishedReadingLists, indexedMaterialCount] = await Promise.all([
      this.prisma.book.count({ where: { isActive: true } }),
      this.prisma.bookCopy.count({ where: { status: BookCopyStatus.AVAILABLE } }),
      this.prisma.readingList.count({ where: { status: 'PUBLISHED', isActive: true } }),
      this.materialSearch.countAccessibleIndexedMaterials(materialAccessContext),
    ]);

    const promptContext: PromptContext = {
      userName: user.name,
      userRole: user.role,
      userFaculty: user.faculty?.name,
      userInterests: user.interests,
      activeBorrowsCount: user.borrows.length,
      currentlyBorrowed: user.borrows.map((b) => b.bookCopy.book.title),
      maxActiveBorrows: policy?.maxActiveBorrows ?? 5,
      maxBorrowDays: policy?.maxBorrowDays ?? 14,
      maxExtensions: policy?.maxExtensions ?? 2,
      catalogTotalBooks,
      catalogAvailableCopies,
      publishedReadingLists,
      indexedMaterials: indexedMaterialCount,
      currentDate: new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
      responseIntent: this.detectResponseIntent(message),
      scientificOutput: this.detectScientificOutput(message),
      pythonExecutionAvailable: this.pythonExecution.isAvailable(),
    };

    const hasManualModeOverride = typeof manualModesInput === 'string' || Array.isArray(manualModesInput);
    const hasModelOverride = typeof modelOverride === 'string';
    const conversation = conversationId
      ? await this.prisma.aiConversation.findFirst({
          where: { id: conversationId, userId },
          select: {
            id: true,
            studyBookId: true,
            manualModes: true,
            lastAutoModes: true,
            manualModel: true,
            lastResolvedModel: true,
            lastModelSelectionSource: true,
          },
        })
      : null;

    if (conversationId && !conversation) {
      yield { type: 'text', text: 'Conversation not found.' };
      return;
    }

    let messageCount = 0;
    if (conversationId) {
      messageCount = await this.prisma.aiMessage.count({ where: { userId, conversationId } });
    }

    // DB is the source of truth for conversation context.
    // When a conversationId is present, fetch the last 50 messages from PostgreSQL.
    // The frontend-supplied history array is only used as a fallback for conversations without an ID.
    const dbHistory = conversationId
      ? await this.getRecentConversationMessages(userId, conversationId)
      : history;

    const storedModeState = this.buildConversationModeState(conversation ?? {});
    const storedModelState = this.buildConversationModelState(conversation ?? {});
    const manualModes = hasManualModeOverride
      ? normalizeAiModes(manualModesInput)
      : storedModeState.manualModes;
    const manualModel = hasModelOverride
      ? this.normalizeManualModel(modelOverride)
      : storedModelState.manualModel;
    const autoModes = inferAutoModes({
      message,
      history: dbHistory,
      isStudySession: !!conversation?.studyBookId,
    });
    const modeState = buildAiModeState({
      manualModes,
      lastAutoModes: autoModes,
      isStudySession: !!conversation?.studyBookId,
    });
    let modelState = this.resolveModelSelection(message, hasImage, manualModel, !!conversation?.studyBookId);

    const systemPrompt = `${buildModeInstructionBlock(modeState.activeModes)}${buildSystemPromptFromModule(promptContext)}`;

    if (conversationId) {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        lastAutoModes: modeState.lastAutoModes,
        manualModel: modelState.manualModel,
        lastResolvedModel: modelState.lastResolvedModel,
        lastModelSelectionSource: modelState.lastModelSelectionSource,
      };

      if (messageCount === 0) {
        updateData.title = message.trim().substring(0, 60) || 'New Chat';
      }

      if (hasManualModeOverride) {
        updateData.manualModes = modeState.manualModes;
      }

      await this.prisma.aiConversation.update({ where: { id: conversationId }, data: updateData });
    }

    yield { type: 'mode_state', modeState };
    yield { type: 'model_state', modelState };

    if (user.role !== Role.ADMIN && this.isAdminAnalyticsRequest(message)) {
      const deniedText = this.buildAdminAnalyticsDeniedResponse(user.role);
      yield { type: 'text', text: deniedText };
      await this.saveMessage(userId, 'user', message, conversationId);
      await this.saveMessage(userId, 'assistant', deniedText, conversationId);
      return;
    }

    const literalPieChart = this.parseLiteralPieChartRequest(message);
    if (literalPieChart) {
      const chartText = this.buildLiteralPieChartResponse(literalPieChart);
      yield { type: 'text', text: chartText };
      await this.saveMessage(userId, 'user', message, conversationId);
      await this.saveMessage(userId, 'assistant', chartText, conversationId);
      return;
    }

    if (user.role === Role.ADMIN && this.isAdminAnalyticsRequest(message)) {
      let dashboardText: string;
      if (this.isMostBorrowedCategoryRequest(message)) {
        dashboardText = await this.buildMostBorrowedCategoryDashboardResponse();
      } else if (this.isMostBorrowedBookRequest(message)) {
        dashboardText = await this.buildMostBorrowedBooksDashboardResponse();
      } else {
        dashboardText = await this.buildAdminAnalyticsDashboardResponse();
      }
      yield { type: 'text', text: dashboardText };
      await this.saveMessage(userId, 'user', message, conversationId);
      await this.saveMessage(userId, 'assistant', dashboardText, conversationId);
      return;
    }

    // ── Full-recall path ───────────────────────────────────────────────────────
    // Handles: "what did we discuss?", "recall this session", "summarize the chat", etc.
    // Fetches all messages using { userId, conversationId } — never by userId alone.

    if (conversationId && this.detectFullRecall(message)) {
      const {
        directRecallMaxMessages,
        maxMessagesProcessedPerRecall,
        chunkSizeMessages,
        maxChunksPerRecall,
        maxSummaryTokensPerChunk,
        maxFinalSummaryTokens,
      } = AgentService.MEMORY_RECALL_LIMITS;

      const recallStart = Date.now();
      const {
        messages: processedMessages,
        totalCount,
        truncated,
      } = await this.getRecallMessagesForConversation(userId, conversationId);

      if (totalCount === 0) {
        const noHistoryText = 'There are no saved messages in this conversation yet.';
        yield { type: 'text', text: noHistoryText };
        await this.saveMessage(userId, 'user', message, conversationId);
        await this.saveMessage(userId, 'assistant', noHistoryText, conversationId);
        return;
      }

      if (truncated) {
        this.logger.warn(
          `[recall] userId=${userId} convId=${conversationId} totalMessages=${totalCount} truncatedTo=${maxMessagesProcessedPerRecall}`,
        );
      }

      const truncationNote = truncated
        ? `\n\n> Note: this conversation has ${totalCount} messages. Only the most recent ${maxMessagesProcessedPerRecall} were included in this summary.`
        : '';

      // ── Direct recall (≤60 messages) ────────────────────────────────────────
      if (processedMessages.length <= directRecallMaxMessages) {
        this.logger.log(
          `[recall] mode=direct userId=${userId} convId=${conversationId} messageCount=${processedMessages.length} totalCount=${totalCount}`,
        );

        const formatted = this.formatMessagesForRecall(processedMessages);
        const recallPrompt =
          `The user asked to recall this conversation. Full message history:\n\n${formatted}` +
          `${truncationNote}\n\nProvide a clear, concise summary of what was discussed.`;

        const recallText = await this.completeRecallPrompt({
          userId,
          conversationId,
          model: modelState.activeModel ?? OPENROUTER_MODELS.CHEAP,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: recallPrompt },
          ],
          maxTokens: maxFinalSummaryTokens,
          fallbackText: 'I was unable to retrieve the conversation history right now.',
        });

        this.logger.log(
          `[recall] mode=direct completed userId=${userId} convId=${conversationId} durationMs=${Date.now() - recallStart}`,
        );

        yield { type: 'text', text: recallText };
        await this.saveMessage(userId, 'user', message, conversationId);
        await this.saveMessage(userId, 'assistant', recallText, conversationId);
        return;
      }

      // ── Chunked recall (>60 messages) ───────────────────────────────────────
      // Each chunk is summarized with a separate API call.
      // Chunk summaries are then combined in a final API call.

      const allChunks: { role: string; content: string }[][] = [];
      for (let i = 0; i < processedMessages.length; i += chunkSizeMessages) {
        allChunks.push(processedMessages.slice(i, i + chunkSizeMessages));
      }

      const chunksToProcess = allChunks.length > maxChunksPerRecall
        ? allChunks.slice(-maxChunksPerRecall)
        : allChunks;

      this.logger.log(
        `[recall] mode=chunked userId=${userId} convId=${conversationId} totalCount=${totalCount} processedMessages=${processedMessages.length} chunks=${chunksToProcess.length} truncated=${truncated}`,
      );

      const chunkSummaries: string[] = [];

      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunkStart = Date.now();
        const chunkText = this.formatMessagesForRecall(chunksToProcess[i]);
        const chunkPrompt =
          `Summarize this portion of a conversation (part ${i + 1} of ${chunksToProcess.length}). ` +
          `Be concise. Do not add information not present in the messages:\n\n${chunkText}`;

        const chunkSummary = await this.completeRecallPrompt({
          userId,
          conversationId,
          model: modelState.activeModel ?? OPENROUTER_MODELS.CHEAP,
          messages: [
            {
              role: 'system',
              content: 'You summarize sections of a conversation accurately and concisely. Never add information not present in the provided messages.',
            },
            { role: 'user', content: chunkPrompt },
          ],
          maxTokens: maxSummaryTokensPerChunk,
          fallbackText: `[Part ${i + 1}: summary unavailable]`,
        });

        chunkSummaries.push(`[Part ${i + 1}] ${chunkSummary}`);
        this.logger.log(
          `[recall] chunk ${i + 1}/${chunksToProcess.length} userId=${userId} convId=${conversationId} durationMs=${Date.now() - chunkStart}`,
        );
      }

      const finalPrompt =
        `The user asked to recall this conversation. It was divided into ${chunksToProcess.length} parts. ` +
        `Here are the summaries of each part:\n\n${chunkSummaries.join('\n\n')}` +
        `${truncationNote}\n\nProvide a coherent final summary of what was discussed across all parts.`;

      const finalText = await this.completeRecallPrompt({
        userId,
        conversationId,
        model: modelState.activeModel ?? OPENROUTER_MODELS.CHEAP,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalPrompt },
        ],
        maxTokens: maxFinalSummaryTokens,
        fallbackText: 'I was unable to combine the conversation summaries right now.',
      });

      this.logger.log(
        `[recall] mode=chunked completed userId=${userId} convId=${conversationId} chunks=${chunksToProcess.length} durationMs=${Date.now() - recallStart}`,
      );

      yield { type: 'text', text: finalText };
      await this.saveMessage(userId, 'user', message, conversationId);
      await this.saveMessage(userId, 'assistant', finalText, conversationId);
      return;
    }

    // ── Build messages — OpenRouter uses OpenAI-compatible message format ──────
    type ChatMessage = Record<string, unknown>;

    let userContent: unknown;
    if (hasImage && imageBase64) {
      userContent = [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        { type: 'text', text: message },
      ];
    } else {
      userContent = message;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...dbHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    messages.push({ role: 'user', content: userContent });

    // Decide whether to use tools based on message complexity
    const simple = this.isSimpleMessage(message);
    const deep = this.isDeepQuery(message);
    const useTools = !hasImage && !simple;
    let model = modelState.activeModel ?? OPENROUTER_MODELS.CHEAP;

    const tierLabel = deep ? 'SMART' : simple ? 'FREE' : hasImage ? 'CHEAP(vision)' : 'CHEAP(tools)';
    this.logger.log(`🤖 AI Request — model: ${model} | tools: ${useTools} | tier: ${tierLabel}`);

    // Agent loop — max 5 rounds of tool calling
    const MAX_ROUNDS = 5;
    const allCitations: BookCitation[] = [];
    let round = 0;

    while (round < MAX_ROUNDS) {
      round++;

      const body: Record<string, unknown> = {
        model,
        messages,
        stream: false,
        max_tokens: this.chatMaxTokens,
      };

      // On the last round, remove tools to force the model to produce a text answer
      const isLastRound = round === MAX_ROUNDS;
      if (useTools && !isLastRound) {
        body.tools = this.getTools(user.role);
        body.tool_choice = 'auto';
      } else if (isLastRound && useTools) {
        this.logger.warn(`Round ${round}/${MAX_ROUNDS} — forcing text response (no tools)`);
      }

      const res = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        // If free tier is rate-limited, auto-fallback to cheap tier
        if (res.status === 429 && model === OPENROUTER_MODELS.FREE) {
          this.logger.warn(`Free tier rate-limited, falling back to CHEAP tier`);
          this.logFallback(modelState.manualModel ?? model, OPENROUTER_MODELS.CHEAP, 'rate_limit_fallback', 'rate_limit');
          model = OPENROUTER_MODELS.CHEAP;
          modelState = {
            ...modelState,
            lastResolvedModel: model,
            lastModelSelectionSource: 'rate_limit_fallback',
            activeModel: model,
            reason: 'rate_limit',
          };
          if (conversationId) {
            await this.prisma.aiConversation.update({
              where: { id: conversationId },
              data: {
                lastResolvedModel: modelState.lastResolvedModel,
                lastModelSelectionSource: modelState.lastModelSelectionSource,
              },
            });
          }
          yield { type: 'model_state', modelState };
          body.model = model;
          round--; // don't count this as a tool-loop round
          continue;
        }
        this.logger.error(`OpenRouter API error ${res.status}: ${errText}`);
        const fallbackText =
          AgentService.FINAL_PROVIDER_FAILURE_MESSAGES[res.status] ??
          AgentService.DEFAULT_PROVIDER_FAILURE_MESSAGE;
        yield { type: 'text', text: fallbackText };
        await this.saveMessage(userId, 'user', message, conversationId);
        await this.saveMessage(userId, 'assistant', fallbackText, conversationId);
        return;
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const choice = data.choices[0];
      this.tokenTrackerService.record(userId, conversationId, {
        provider: 'openrouter',
        model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      });

      this.logger.log(`📊 Tokens — in: ${data.usage?.prompt_tokens ?? 0} | out: ${data.usage?.completion_tokens ?? 0} | model: ${model}`);

      const msg = choice?.message;

      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });

        for (const toolCall of msg.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
          this.logger.log(`🔧 Tool call: ${toolCall.function.name}(${JSON.stringify(args)})`);
          const { result, citations } = await this.executeTool(
            toolCall.function.name, args, userId, user.role, cookieHeader,
          );
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
          allCitations.push(...citations);
        }
        continue;
      }

      let fullResponse = msg?.content ?? '';

      if (!fullResponse) {
        if (hasImage) {
          fullResponse = 'I received your image but could not analyse it.';
        } else if (allCitations.length > 0) {
          fullResponse = 'Here are the results I found:';
        } else {
          fullResponse = 'I\'m sorry, I wasn\'t able to generate a response. Could you rephrase your question?';
        }
      }

      yield { type: 'text', text: fullResponse };

      // Emit deduplicated book citations
      const uniqueCitations = Array.from(
        new Map(allCitations.map((c) => [c.catalogLink, c])).values(),
      );
      if (uniqueCitations.length > 0) {
        yield { type: 'books', books: uniqueCitations };
      }

      await this.saveMessage(userId, 'user', message, conversationId);
      await this.saveMessage(userId, 'assistant', fullResponse, conversationId);
      return;
    }

    const hasToolResults = messages.some((entry) => entry.role === 'tool');
    if (hasToolResults) {
      const synthesisRes = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.openRouterHeaders,
        body: JSON.stringify({
          model,
          messages: [
            ...messages,
            {
              role: 'user',
              content: 'Answer the user now using only the tool results already gathered. Do not call any tools. If the question is about a book structure, chapters, parts, or table of contents, answer directly from the book content you already read.',
            },
          ],
          stream: false,
          max_tokens: this.chatMaxTokens,
        }),
      });

      if (synthesisRes.ok) {
        const synthesisData = await synthesisRes.json() as {
          choices: Array<{ message: { content: string | null } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        this.tokenTrackerService.record(userId, conversationId, {
          provider: 'openrouter',
          model,
          inputTokens: synthesisData.usage?.prompt_tokens ?? 0,
          outputTokens: synthesisData.usage?.completion_tokens ?? 0,
        });

        const synthesisText = synthesisData.choices[0]?.message?.content?.trim() ?? '';
        if (synthesisText) {
          yield { type: 'text', text: synthesisText };

          const uniqueCitations = Array.from(
            new Map(allCitations.map((c) => [c.catalogLink, c])).values(),
          );
          if (uniqueCitations.length > 0) {
            yield { type: 'books', books: uniqueCitations };
          }

          await this.saveMessage(userId, 'user', message, conversationId);
          await this.saveMessage(userId, 'assistant', synthesisText, conversationId);
          return;
        }
      } else {
        const synthesisErr = await synthesisRes.text();
        this.logger.warn(`Final synthesis failed (${synthesisRes.status}): ${synthesisErr}`);
      }
    }

    const fallback = 'I was unable to complete the request after multiple attempts. Please try again.';
    yield { type: 'text', text: fallback };
    await this.saveMessage(userId, 'user', message, conversationId);
    await this.saveMessage(userId, 'assistant', fallback, conversationId);
  }
}
