import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSearchService } from './catalog-search.service';
import { BorrowStatus, BookCopyStatus, IndexStatus, Role } from '@prisma/client';
import { buildSystemPrompt as buildSystemPromptFromModule, PromptContext } from './prompts/system-prompt-builder';
import { ToolHookService } from './tools/tool-hook.service';
import { ToolExecutionContext } from './tools/tool-hooks';
import { TokenTrackerService } from './session/token-tracker.service';
import { MaterialSearchService } from '../materials/material-search.service';
import { BookDocumentService, BookPdfContent } from '../books/book-document.service';
import { OPENROUTER_MODELS } from './providers/openrouter.provider';
import { AiModeState, buildAiModeState, buildModeInstructionBlock, getDefaultAutoModes, inferAutoModes, normalizeAiModes } from './ai-modes';

export interface BookCitation {
  title: string;
  catalogLink: string;
  available: boolean;
  copies: string;
}

export type ChatChunk =
  | { type: 'mode_state'; modeState: AiModeState }
  | { type: 'text'; text: string }
  | { type: 'books'; books: BookCitation[] };

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly openRouterBaseUrl = 'https://openrouter.ai/api/v1';
  private readonly chatMaxTokens = 2048;
  private readonly studyGuideMaxTokens = 1536;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogSearch: CatalogSearchService,
    private readonly toolHookService: ToolHookService,
    private readonly tokenTrackerService: TokenTrackerService,
    private readonly materialSearch: MaterialSearchService,
    private readonly bookDocumentService: BookDocumentService,
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

  private serializeConversation(conversation: {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    studyBookId?: string | null;
    manualModes?: string[];
    lastAutoModes?: string[];
  }) {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      studyBookId: conversation.studyBookId ?? null,
      ...this.buildConversationModeState(conversation),
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

  async updateConversationMode(id: string, userId: string, requestedManualModes?: string[] | string): Promise<void> {
    await this.prisma.aiConversation.updateMany({
      where: { id, userId },
      data: { manualModes: normalizeAiModes(requestedManualModes) },
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
          description: 'Get the opening outline (first few chunks) of a study material to understand its structure and main topics.',
          parameters: {
            type: 'object',
            properties: {
              materialId: { type: 'string', description: 'The material ID' },
            },
            required: ['materialId'],
          },
        },
      },
    ];
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

    const excerpt = this.buildRelevantExcerpt(content.text, question, 4000);
    return `E-BOOK CONTENT (for: ${question}):\n\n${metadata.join('\n')}${metadata.length > 0 ? '\n\n' : ''}${excerpt}`;
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
    };

    const hasManualModeOverride = typeof manualModesInput === 'string' || Array.isArray(manualModesInput);
    const conversation = conversationId
      ? await this.prisma.aiConversation.findFirst({
          where: { id: conversationId, userId },
          select: { id: true, studyBookId: true, manualModes: true, lastAutoModes: true },
        })
      : null;

    if (conversationId && !conversation) {
      yield { type: 'text', text: 'Conversation not found.' };
      return;
    }

    let messageCount = 0;
    if (conversationId) {
      messageCount = await this.prisma.aiMessage.count({ where: { conversationId } });
    }

    const storedModeState = this.buildConversationModeState(conversation ?? {});
    const manualModes = hasManualModeOverride
      ? normalizeAiModes(manualModesInput)
      : storedModeState.manualModes;
    const autoModes = inferAutoModes({
      message,
      history,
      isStudySession: !!conversation?.studyBookId,
    });
    const modeState = buildAiModeState({
      manualModes,
      lastAutoModes: autoModes,
      isStudySession: !!conversation?.studyBookId,
    });

    const systemPrompt = `${buildModeInstructionBlock(modeState.activeModes)}${buildSystemPromptFromModule(promptContext)}`;

    if (conversationId) {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        lastAutoModes: modeState.lastAutoModes,
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
    let model = this.pickModel(message, hasImage, modelOverride);

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
        throw new Error(this.getUserFacingProviderError(res.status, errText));
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











