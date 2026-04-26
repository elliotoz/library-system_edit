import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSearchService } from './catalog-search.service';
import { BorrowStatus, BookCopyStatus } from '@prisma/client';
import { buildSystemPrompt as buildSystemPromptFromModule, PromptContext } from './prompts/system-prompt-builder';
import { ToolHookService } from './tools/tool-hook.service';
import { ToolExecutionContext } from './tools/tool-hooks';
import { TokenTrackerService } from './session/token-tracker.service';
import { OPENROUTER_MODELS } from './providers/openrouter.provider';

export interface BookCitation {
  title: string;
  catalogLink: string;
  available: boolean;
  copies: string;
}

export type ChatChunk =
  | { type: 'text'; text: string }
  | { type: 'books'; books: BookCitation[] };

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly openRouterBaseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly toolHookService: ToolHookService,
    private readonly tokenTrackerService: TokenTrackerService,
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

  /** Pick model tier based on message complexity. */
  private pickModel(message: string, hasImage: boolean): string {
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

  // ── Conversations ──────────────────────────────────────────────

  async getConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async createConversation(userId: string) {
    return this.prisma.aiConversation.create({
      data: { userId, title: 'New Chat' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
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
      where: conversationId ? { conversationId } : { userId, conversationId: null },
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

  // ── Tools ──────────────────────────────────────────────────────

  private getTools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return [
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
          description: 'Fetch and read an e-book from its URL.',
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
    ];
  }

  // ── Tool execution ─────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    userRole: string,
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

  private async executeToolInner(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    userRole: string,
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
              availableCopies: book.availableCopies, totalCopies: book.totalCopies,
              isAvailable: book.isAvailable, subjects: book.subjectTags,
              catalogLink: `/dashboard/catalog/${book.id}`,
            }),
            citations: [],
          };
        }

        case 'read_ebook': {
          this.assertSafeUrl(args.url as string);
          const res = await fetch(args.url as string, {
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
          const excerpt = text.length > 4000
            ? text.substring(0, 4000) + '\n\n[Excerpt — full book available at original URL]'
            : text;
          return { result: `E-BOOK CONTENT (for: ${args.question as string}):\n\n${excerpt}`, citations: [] };
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

    const [catalogTotalBooks, catalogAvailableCopies, publishedReadingLists] = await Promise.all([
      this.prisma.book.count({ where: { isActive: true } }),
      this.prisma.bookCopy.count({ where: { status: BookCopyStatus.AVAILABLE } }),
      this.prisma.readingList.count({ where: { status: 'PUBLISHED', isActive: true } }),
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
      currentDate: new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
    };
    const systemPrompt = buildSystemPromptFromModule(promptContext);

    // Auto-title conversation
    if (conversationId) {
      const msgCount = await this.prisma.aiMessage.count({ where: { conversationId } });
      if (msgCount === 0) {
        const title = message.trim().substring(0, 60) || 'New Chat';
        await this.prisma.aiConversation.update({ where: { id: conversationId }, data: { title } });
      }
      await this.prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    // Build messages — OpenRouter uses OpenAI-compatible message format
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
      ...history.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    messages.push({ role: 'user', content: userContent });

    // Decide whether to use tools based on message complexity
    const simple = this.isSimpleMessage(message);
    const deep = this.isDeepQuery(message);
    const useTools = !hasImage && !simple;
    let model = this.pickModel(message, hasImage);

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
        max_tokens: 4096,
      };

      // On the last round, remove tools to force the model to produce a text answer
      const isLastRound = round === MAX_ROUNDS;
      if (useTools && !isLastRound) {
        body.tools = this.getTools();
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
          model = OPENROUTER_MODELS.CHEAP;
          body.model = model;
          round--; // don't count this as a tool-loop round
          continue;
        }
        this.logger.error(`OpenRouter API error ${res.status}: ${errText}`);
        throw new Error(`AI provider error: ${res.status}`);
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

    const fallback = 'I was unable to complete the request after multiple attempts. Please try again.';
    yield { type: 'text', text: fallback };
    await this.saveMessage(userId, 'user', message, conversationId);
    await this.saveMessage(userId, 'assistant', fallback, conversationId);
  }
}
