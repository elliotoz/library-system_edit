# OZ AI — Architecture

## Overview

OZ AI is an **agentic assistant** that answers questions by calling real database tools rather than relying on static context injection. It streams responses token-by-token via Server-Sent Events (SSE) and loops through tool calls until it has enough information to answer.

---

## High-Level Architecture

```
                              USER LAYER
    +----------+    +------------+    +----------+    +----------+
    | STUDENT  |    | INSTRUCTOR |    |   STAFF  |    |  ADMIN   |
    +----+-----+    +-----+------+    +----+-----+    +----+-----+
         |               |                 |               |
         +-------+-------+--------+--------+-------+-------+
                 |
                 v
         +-------+-------------------------------------------+
         |              HTTPS Request                        |
         |      Cookie: access_token=JWT                     |
         +-------------------+-------------------------------+
                             |
                             v
         +-------------------+-------------------------------+
         |           FRONTEND (Next.js 14)                   |
         |  app/dashboard/ai-assistant/page.tsx              |
         |  - Conversation sidebar (persistent history)      |
         |  - SSE reader — renders tokens as they arrive     |
         |  - Markdown rendering with clickable book links   |
         |  - Image upload (compressed via Canvas API)       |
         +-------------------+-------------------------------+
                             |
                             | POST /ai/chat   (SSE response)
                             | { message, conversationId?, image? }
                             v
         +-------------------+-------------------------------+
         |           BACKEND (NestJS 10)                     |
         |  JwtAuthGuard → AiController → AgentService      |
         +-------------------+-------------------------------+
                             |
                             v
+--------------------------------------------------------------------+
|                    AGENTIC LOOP (AgentService)                     |
|                                                                    |
|  1. Build system prompt (user profile, borrows, policy)           |
|  2. Load conversation history from DB (AiMessage)                 |
|  3. Append user message                                            |
|  4. Call Ollama /api/chat with tools injected                      |
|                                                                    |
|  ┌─────────────────────────────────────────┐                       |
|  │  Ollama responds with...                │                       |
|  │                                         │                       |
|  │  tool_call?                             │                       |
|  │  ┌──────YES──────┐   ┌────NO────┐       │                       |
|  │  │ executeTool() │   │ stream   │       │                       |
|  │  │ (Prisma/fetch)│   │ tokens   │       │                       |
|  │  └──────┬────────┘   └──────────┘       │                       |
|  │         │ inject tool result            │                       |
|  │         └──────────► loop back ────────►│                       |
|  └─────────────────────────────────────────┘                       |
|                                                                    |
|  5. Persist user + assistant messages to AiMessage table           |
|  6. Update conversation title on first message                     |
+--------------------------------------------------------------------+
                             |
             +---------------+---------------+
             |                               |
             v                               v
    +--------+--------+             +--------+--------+
    |   PostgreSQL    |             |     Ollama      |
    |   (via Prisma)  |             | localhost:11434 |
    +-----------------+             +-----------------+
```

---

## Service Responsibilities

### AiController (`ai.controller.ts`)

| Endpoint | Method | Purpose | Guard |
|----------|--------|---------|-------|
| `/ai/status` | GET | Ollama availability + installed models | JwtAuthGuard |
| `/ai/conversations` | GET | List user's conversations | JwtAuthGuard |
| `/ai/conversations` | POST | Create new conversation | JwtAuthGuard |
| `/ai/conversations/:id` | DELETE | Delete a conversation | JwtAuthGuard |
| `/ai/history` | GET | Message history (optionally scoped to conversation) | JwtAuthGuard |
| `/ai/chat` | POST | Main SSE chat endpoint | JwtAuthGuard |
| `/ai/interests` | PATCH | Update user interests | JwtAuthGuard |
| `/ai/context` | GET | Debug: view built AI context | JwtAuthGuard |
| `/ai/scan-cover` | POST | Admin: scan book cover image → extract metadata | JwtAuthGuard + RolesGuard(ADMIN) |

### AgentService (`agent.service.ts`)

The core of OZ AI. Responsibilities:

- **Conversation management** — CRUD for `AiConversation` and `AiMessage` Prisma records
- **System prompt** — builds a personalised prompt per user (name, role, faculty, borrows, policy)
- **Tool registry** — defines 8 tools as Ollama `Tool[]` objects
- **Agentic loop** — calls Ollama, detects tool calls, executes them, feeds results back, loops until final answer
- **SSE streaming** — yields tokens to the controller as they arrive via async generator `chatStream()`
- **Message persistence** — saves user + assistant messages after each exchange

### OllamaService (`ollama.service.ts`)

- `generate()` — single-turn generation (used by legacy `ai.service.ts`)
- `chat()` — multi-turn chat with history array (used by legacy path)
- `scanBookCover(base64)` — calls Ollama `/api/generate` with `gemma3:4b` + image; extracts title/authors/ISBN/publisher/year as JSON
- `isAvailable()` — returns current availability flag (updated on every call success/failure)

### ContextBuilderService (`context-builder.service.ts`)

Still used by the legacy `ai.service.ts` path. Executes 15–19 parallel Prisma queries to assemble a full `AiContext` object (user profile, borrow policy, active borrows, reservations, catalog stats, reading lists, borrow history, admin stats).

---

## Tools

| Tool | Parameters | Data Source |
|------|-----------|-------------|
| `search_catalog` | `query`, `pageSize` | `GET /books` API |
| `get_book_details` | `bookId` | `GET /books/:id` API |
| `read_ebook` | `url`, `question` | External HTTP fetch |
| `fetch_webpage` | `url`, `purpose` | External HTTP fetch |
| `get_my_borrows` | — | Prisma direct (scoped to caller) |
| `get_catalog_stats` | — | Prisma direct (6 parallel counts) |
| `get_active_borrows` | — | Prisma direct + raw SQL (top 5) |
| `get_active_reservations` | — | Prisma direct |

---

## Conversation & Message Persistence

```
AiConversation
  id          UUID
  userId      → User
  title       string   (auto-set from first message)
  createdAt
  updatedAt
  messages[]  → AiMessage[]

AiMessage
  id
  userId      → User
  conversationId → AiConversation (nullable — legacy messages)
  role        "user" | "assistant" | "tool"
  content     string
  createdAt
```

History is loaded at the start of each `chatStream()` call (last 50 messages) and passed as the Ollama message array, giving the model full multi-turn context.

---

## Module Dependency Graph

```
                    +-------------+
                    | AppModule   |
                    +------+------+
                           |
                           v
                    +------+------+
                    |  AiModule   |
                    +------+------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
   +------+------+  +------+------+  +------+------+
   | UsersModule |  |PrismaModule |  | AuthModule  |
   +-------------+  +-------------+  +-------------+
                                            |
                    +-----------------------+
                    |
                    v
         +----------+----------+
         |                     |
         v                     v
  +-------------+      +---------------+
  | AgentService|      | AiService     |
  | (agentic    |      | (legacy       |
  |  SSE loop)  |      |  orchestrator)|
  +-------------+      +---------------+
         |
         v
  +-------------+
  | OllamaService|
  +-------------+
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/ai/ai.module.ts` | Module definition |
| `src/ai/ai.controller.ts` | REST + SSE endpoints |
| `src/ai/agent.service.ts` | Agentic loop, tools, SSE streaming, conversation persistence |
| `src/ai/ai.service.ts` | Legacy orchestrator (intent-router path, still registered) |
| `src/ai/context-builder.service.ts` | DB context gatherer (used by legacy path) |
| `src/ai/ollama.service.ts` | LLM calls + cover scan |
| `src/ai/dto/chat.dto.ts` | Chat request DTO |
| `src/ai/dto/scan-cover.dto.ts` | Cover scan DTO (base64, 2MB cap) |
| `src/ai/dto/update-interests.dto.ts` | Interests update DTO |
