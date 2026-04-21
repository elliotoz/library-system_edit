import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSearchService } from './catalog-search.service';
import { BorrowStatus } from '@prisma/client';

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
  private readonly groq: Groq;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogSearch: CatalogSearchService,
  ) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }

  // ── Status ─────────────────────────────────────────────────────

  async getStatus(): Promise<{ available: boolean; model: string }> {
    return {
      available: !!process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
    };
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

  // ── System prompt ──────────────────────────────────────────────

  private buildSystemPrompt(user: {
    name: string;
    role: string;
    faculty?: { name: string } | null;
    interests: string[];
    activeBorrowsCount?: number;
    borrowPolicy?: { maxActiveBorrows: number; maxBorrowDays: number; maxExtensions: number } | null;
    borrows?: { book: { title: string } }[];
  }): string {
    const borrowTitles = user.borrows?.map((b) => b.book.title).join(', ') || 'nothing';
    const today = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    return `You are OZ AI — the AI assistant for AI Integrated Library System.
You are smart, academic, friendly, and precise.
Respond in English by default. Only switch to Turkish if the user's message is written in Turkish.

## Current User
Name: ${user.name}
Role: ${user.role}
Faculty: ${user.faculty?.name || 'Unknown'}
Interests: ${user.interests.join(', ') || 'not set yet'}
Currently Borrowed: ${borrowTitles}
Active Borrows: ${user.activeBorrowsCount ?? 0} / ${user.borrowPolicy?.maxActiveBorrows ?? 5} max
Borrow Policy: ${user.borrowPolicy?.maxBorrowDays ?? 14} days, ${user.borrowPolicy?.maxExtensions ?? 2} extensions

## Your Capabilities
You have tools to search the library catalog, count catalog stats, get book details,
read and summarise e-books, fetch web pages, check your own borrows, and — for staff/admin —
view all active borrows and reservations across the library.
You have direct, real-time access to the library database through these tools.

## Behaviour Rules
- ALWAYS use a tool to answer library data questions. NEVER guess or invent numbers.
- To count books: call get_catalog_stats — it returns exact totals from the database.
- To search by title, author, topic, or subject: call search_catalog.
- For specific book-title requests ("find X", "get X", "fetch X"): call search_catalog with the title as the query. Do NOT report "not found" until the tool has returned zero results.
- For topic/concept requests ("books about X", "related to X", "X books"): call search_catalog.
- When search_catalog returns formatted result lines, reproduce them verbatim in your reply.
- When get_book_details returns a catalogLink field, use that exact value as the link: [Title](catalogLink). Never construct /dashboard/catalog/... manually.
- Never use ebookUrl as the main link. Only mention it when the user explicitly asks to open/read/download e-book content.
- To see active borrows or the most-borrowed book: call get_active_borrows.
- To see active reservations: call get_active_reservations.
- NEVER write Python, SQL, shell, or any code to answer a library question — call the tool.
- For code questions (user explicitly asking to write code), reply with a code block only.
- When summarising a book, call read_ebook first — never invent summaries.
- Use markdown: bullet points for lists, headings for long answers, fenced code blocks for code.
- Be concise. Today is ${today}.`;
  }

  // ── Tools ──────────────────────────────────────────────────────

  private getTools(): Groq.Chat.ChatCompletionTool[] {
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
    ];
  }

  // ── Tool execution ─────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    cookieHeader: string,
  ): Promise<{ result: string; citations: BookCitation[] }> {
    const API_BASE = 'http://localhost:3001';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    };

    try {
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

        default:
          return { result: 'Unknown tool.', citations: [] };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${name} failed: ${msg}`);
      return { result: `Tool error: ${msg}`, citations: [] };
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
    const borrowsForPrompt = user.borrows.map((b) => ({ book: { title: b.bookCopy.book.title } }));
    const systemPrompt = this.buildSystemPrompt({
      name: user.name, role: user.role, faculty: user.faculty,
      interests: user.interests, activeBorrowsCount: user.borrows.length,
      borrowPolicy: policy, borrows: borrowsForPrompt,
    });

    // Auto-title conversation
    if (conversationId) {
      const msgCount = await this.prisma.aiMessage.count({ where: { conversationId } });
      if (msgCount === 0) {
        const title = message.trim().substring(0, 60) || 'New Chat';
        await this.prisma.aiConversation.update({ where: { id: conversationId }, data: { title } });
      }
      await this.prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }

    // Build messages — Groq uses OpenAI message format
    type GroqMessage = Groq.Chat.ChatCompletionMessageParam;

    let userContent: GroqMessage['content'];
    if (hasImage && imageBase64) {
      userContent = [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        { type: 'text', text: message },
      ];
    } else {
      userContent = message;
    }

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m): GroqMessage => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userContent },
    ];

    const model = hasImage ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

    // Agent loop — max 3 rounds
    const allCitations: BookCitation[] = [];
    let round = 0;

    while (round < 3) {
      round++;

      const response = await this.groq.chat.completions.create({
        model,
        messages,
        tools: hasImage ? undefined : this.getTools(),
        tool_choice: hasImage ? undefined : 'auto',
        stream: false,
      });

      const choice = response.choices[0];
      const msg = choice?.message;

      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });

        for (const toolCall of msg.tool_calls) {
          // IMPORTANT: Groq returns arguments as a JSON string — must parse
          const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
          const { result, citations } = await this.executeTool(
            toolCall.function.name, args, userId, cookieHeader,
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

      // Final answer — stream it
      const finalStream = await this.groq.chat.completions.create({
        model,
        messages,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of finalStream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          fullResponse += text;
          yield { type: 'text', text };
        }
      }

      if (!fullResponse && hasImage) {
        const fallback = 'I received your image but could not analyse it.';
        yield { type: 'text', text: fallback };
        fullResponse = fallback;
      }

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
