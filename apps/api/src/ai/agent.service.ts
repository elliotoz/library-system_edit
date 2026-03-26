import { Injectable, Logger } from '@nestjs/common';
import { Ollama, Message as OllamaMessage, Tool } from 'ollama';
import { PrismaService } from '../prisma/prisma.service';
import { BorrowStatus } from '@prisma/client';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly ollama: Ollama;

  constructor(private readonly prisma: PrismaService) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434' });
  }

  // ── Status ─────────────────────────────────────────────────────

  async getStatus(): Promise<{ available: boolean; models: string[] }> {
    try {
      const res = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
      if (!res.ok) return { available: false, models: [] };
      const data = await res.json() as { models: { name: string }[] };
      return { available: true, models: data.models.map((m) => m.name) };
    } catch {
      return { available: false, models: [] };
    }
  }

  // ── History ────────────────────────────────────────────────────

  async getHistory(userId: string) {
    return this.prisma.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async saveMessage(userId: string, role: string, content: string) {
    return this.prisma.aiMessage.create({ data: { userId, role, content } });
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

    return `You are ÜLIB — the AI assistant for Üsküdar University Library System.
You are smart, academic, friendly, and precise.
Respond in the same language the user writes in (Turkish or English).

## Current User
Name: ${user.name}
Role: ${user.role}
Faculty: ${user.faculty?.name || 'Unknown'}
Interests: ${user.interests.join(', ') || 'not set yet'}
Currently Borrowed: ${borrowTitles}
Active Borrows: ${user.activeBorrowsCount ?? 0} / ${user.borrowPolicy?.maxActiveBorrows ?? 5} max
Borrow Policy: ${user.borrowPolicy?.maxBorrowDays ?? 14} days, ${user.borrowPolicy?.maxExtensions ?? 2} extensions

## Your Capabilities
You have tools to search the library catalog, get book details,
read and summarise e-books, fetch web pages, and check borrow status.

## Behaviour Rules
- ALWAYS call search_catalog before saying a book is or is not available
- For code questions, reply directly: "Yes, here is Hello World in Python:"
  then immediately give the code block. Do not over-explain unless asked.
- When summarising a book, call read_ebook first — never invent summaries
- Use markdown: bullet points for lists, headings for long answers,
  fenced code blocks with language tags for all code
- Be concise. Today is ${today}.`;
  }

  // ── Tools ──────────────────────────────────────────────────────

  private getTools(): Tool[] {
    const tools: Tool[] = [
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
          description: 'Fetch and read an e-book from its URL. Use to summarise or answer questions about book content.',
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
          description: 'Fetch any public URL to look up information. Use for Wikipedia, academic papers, or URLs the user provides.',
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
          description: "Get the user's current active borrows and due dates.",
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
    return tools;
  }

  // ── Tool execution ─────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
    cookieHeader: string,
  ): Promise<string> {
    const API_BASE = 'http://localhost:3001';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    };

    try {
      switch (name) {
        case 'search_catalog': {
          const pageSize = Math.min((args.pageSize as number) || 5, 10);
          const res = await fetch(
            `${API_BASE}/books?page=1&pageSize=${pageSize}&search=${encodeURIComponent(args.query as string)}`,
            { headers },
          );
          if (!res.ok) return 'Catalog search failed.';
          const data = await res.json() as { data?: Record<string, unknown>[] };
          if (!data.data?.length) return 'No books found for that search.';
          const mapped = data.data.map((b: Record<string, unknown>) => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            isEbook: b.isEbookAvailable,
            available: b.isAvailable,
            copies: `${b.availableCopies}/${b.totalCopies}`,
            subjects: b.subjectTags,
            description: typeof b.description === 'string' ? b.description.substring(0, 200) : undefined,
          }));
          return JSON.stringify(mapped);
        }

        case 'get_book_details': {
          const res = await fetch(`${API_BASE}/books/${args.bookId as string}`, { headers });
          if (!res.ok) return 'Book not found.';
          const book = await res.json() as Record<string, unknown>;
          return JSON.stringify({
            id: book.id, title: book.title, authors: book.authors,
            description: book.description, publisher: book.publisher,
            year: book.publicationYear, pages: book.pageCount,
            isbn: book.isbn, language: book.language,
            isEbook: book.isEbookAvailable, ebookUrl: book.ebookUrl,
            availableCopies: book.availableCopies, totalCopies: book.totalCopies,
            isAvailable: book.isAvailable, subjects: book.subjectTags,
          });
        }

        case 'read_ebook': {
          const res = await fetch(args.url as string, {
            headers: { 'User-Agent': 'UskudarLibraryBot/1.0' },
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
          return `E-BOOK CONTENT (for: ${args.question as string}):\n\n${excerpt}`;
        }

        case 'fetch_webpage': {
          const res = await fetch(args.url as string, {
            headers: { 'User-Agent': 'UskudarLibraryBot/1.0' },
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
          return `WEB PAGE (${args.url as string}):\n\n${text}`;
        }

        case 'get_my_borrows': {
          const borrows = await this.prisma.borrow.findMany({
            where: { userId, status: BorrowStatus.ACTIVE },
            include: {
              bookCopy: { include: { book: { select: { title: true } } } },
            },
          });
          if (!borrows.length) return 'No active borrows.';
          const now = new Date();
          const mapped = borrows.map((b) => {
            const daysLeft = Math.ceil((new Date(b.dueAt).getTime() - now.getTime()) / 86400000);
            return {
              title: b.bookCopy.book.title,
              dueDate: b.dueAt,
              daysLeft,
              isOverdue: daysLeft < 0,
            };
          });
          return JSON.stringify(mapped);
        }

        default:
          return 'Unknown tool.';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${name} failed: ${msg}`);
      return `Tool error: ${msg}`;
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
  ): AsyncGenerator<string> {
    // Load user context
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
      yield 'User not found.';
      return;
    }

    // Fetch borrow policy by role (BorrowPolicy is keyed by Role enum, not userId)
    const policy = await this.prisma.borrowPolicy.findUnique({ where: { role: user.role } });

    // Map borrows to { book: { title } } shape for buildSystemPrompt
    const borrowsForPrompt = user.borrows.map((b) => ({
      book: { title: b.bookCopy.book.title },
    }));

    const systemPrompt = this.buildSystemPrompt({
      name: user.name,
      role: user.role,
      faculty: user.faculty,
      interests: user.interests,
      activeBorrowsCount: user.borrows.length,
      borrowPolicy: policy,
      borrows: borrowsForPrompt,
    });

    // Select model
    const codeKeywords = ['code', 'python', 'c++', 'javascript', 'typescript', 'function', 'class', 'implement', 'write a', 'syntax', 'algorithm'];
    const isCode = codeKeywords.some((kw) => message.toLowerCase().includes(kw));
    const model = hasImage ? 'llava:13b' : (isCode ? 'qwen2.5-coder:7b' : 'qwen2.5:14b');

    // Build messages — Ollama Message has content:string and images?:string[]
    const userMsg: OllamaMessage = hasImage && imageBase64
      ? { role: 'user', content: message, images: [imageBase64] }
      : { role: 'user', content: message };

    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((m): OllamaMessage => ({ role: m.role, content: m.content })),
      userMsg,
    ];

    // Agent loop — max 3 rounds
    let round = 0;
    while (round < 3) {
      round++;

      const response = await this.ollama.chat({
        model,
        messages,
        tools: hasImage ? undefined : this.getTools(),
        stream: false,
      });

      const msg = response.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content });

        for (const toolCall of msg.tool_calls) {
          const args = (toolCall.function?.arguments ?? {}) as Record<string, unknown>;
          const result = await this.executeTool(toolCall.function.name, args, userId, cookieHeader);
          messages.push({ role: 'tool', content: result });
        }
        continue;
      }

      // Final answer — stream it
      const finalStream = await this.ollama.chat({
        model,
        messages,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of finalStream) {
        const text = chunk.message?.content ?? '';
        if (text) {
          fullResponse += text;
          yield text;
        }
      }

      // Persist to DB
      await this.saveMessage(userId, 'user', message);
      await this.saveMessage(userId, 'assistant', fullResponse);
      return;
    }

    // Fallback if loop exhausted without final answer
    const fallback = 'I was unable to complete the request after multiple attempts. Please try again.';
    yield fallback;
    await this.saveMessage(userId, 'user', message);
    await this.saveMessage(userId, 'assistant', fallback);
  }
}
