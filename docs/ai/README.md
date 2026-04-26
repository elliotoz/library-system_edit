# OZ AI — Documentation

This directory contains comprehensive documentation for OZ AI, the agentic assistant built into the AI Integrated Library System.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Agentic loop, SSE streaming, service responsibilities, data flow |
| [User Guide](./USER_GUIDE.md) | Role-specific capabilities, example prompts, conversation history |
| [Technical Deep-Dive](./TECHNICAL_DEEP_DIVE.md) | System prompt, tool definitions, security, performance |
| [End-to-End Diagram](./END_TO_END_DIAGRAM.md) | Complete integration flow from UI to database |

---

## OZ AI Overview

OZ AI is **not** a generic chatbot. It is a tool-calling agent with real-time access to the library database. Every answer about library data is backed by a live database call — no guessing, no hallucination.

### Key Features

| Feature | Description |
|---------|-------------|
| Catalog Search | Natural language book discovery via `search_catalog` tool |
| Catalog Stats | Exact live counts via `get_catalog_stats` tool |
| Book Details | Full availability, e-book link via `get_book_details` tool |
| E-Book Reading | Fetch and summarise e-book content via `read_ebook` tool |
| Web Fetch | Look up Wikipedia, papers, or any URL via `fetch_webpage` tool |
| Active Borrows | User's own borrows via `get_my_borrows`; system-wide via `get_active_borrows` |
| Reservations | System-wide reservation status via `get_active_reservations` |
| User Stats | Total user counts by role via `get_user_stats` (admin only) |
| Image Understanding | Attach any image to a message — OZ can describe and reason about it |
| Conversation History | Persistent per-conversation message history (AiConversation model) |
| Book Cover Scan | Admin: scan cover image → auto-fill book form (Gemini Flash multimodal) |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| LLM Router | OpenRouter (cloud, OpenAI-compatible API) |
| Models | gemma-4-31b (free), gemini-3.1-flash-lite (cheap), claude-3-haiku (smart) |
| Cover Scan | Google Gemini Flash (via Gemini API) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Next.js 14 |

### Model Tier Selection

| Tier | Model | Trigger |
|------|-------|---------|
| FREE | `google/gemma-4-31b-it:free` | Greetings, short replies, no tool calls needed |
| CHEAP | `google/gemini-3.1-flash-lite-preview` | Tool-calling queries, image messages |
| SMART | `anthropic/claude-3-haiku` | Analytical queries: summarize, compare, analyze, research |

FREE tier rate-limit (429) auto-falls back to CHEAP.

### File Structure

```
apps/api/src/ai/
├── ai.module.ts              # Module definition
├── ai.controller.ts          # REST + SSE endpoints (8 total)
├── agent.service.ts          # Agentic loop — tool-calling, SSE streaming
├── ai.service.ts             # Legacy orchestrator (interests, context)
├── groq.service.ts           # Cover scan + OpenRouter chat utility
├── catalog-search.service.ts # Catalog search with subtitle-stripping fallback
├── providers/
│   ├── openrouter.provider.ts  # OpenRouter client + OPENROUTER_MODELS enum
│   ├── gemini.provider.ts      # Gemini API provider (cover scan)
│   ├── groq.provider.ts        # Groq provider (unused in primary path)
│   └── provider-factory.ts    # Provider selection factory
├── prompts/
│   └── system-prompt-builder.ts  # Dynamic system prompt for each user session
├── session/
│   └── token-tracker.service.ts  # Per-session token usage metrics
├── tools/
│   └── tool-hook.service.ts      # Pre/post/error hooks for tool execution
└── dto/                          # Request/response DTOs
```

### Environment Variables

```env
# Required for AI chat
OPENROUTER_API_KEY="sk-or-v1-..."

# Required for book cover scanning
GEMINI_API_KEY="AIza..."
```

### Getting Started

```bash
# 1. Get a free OpenRouter API key at https://openrouter.ai
# 2. Add to apps/api/.env:
OPENROUTER_API_KEY="sk-or-v1-..."

# 3. Start the application
npm run dev

# 4. Test AI status
curl http://localhost:3001/ai/status -b cookies.txt
# { "available": true, "model": "google/gemini-3.1-flash-lite-preview" }
```

### Extending OZ AI

When adding a new capability:

1. Add a new tool definition to `getTools()` in `agent.service.ts`
2. Add a corresponding `case` block in `executeToolInner()`
3. Update the system prompt behaviour rules if the tool requires routing guidance
4. Update this documentation

### Security

- SSRF protection: `fetch_webpage` and `read_ebook` block localhost, RFC-1918, and link-local addresses
- Tool access is scoped by user role — admin/staff-only tools enforce role checks inside the handler
- The AI never executes write actions — it only reads and informs
- Rate limit: 15 requests per minute per user on `/ai/chat`
