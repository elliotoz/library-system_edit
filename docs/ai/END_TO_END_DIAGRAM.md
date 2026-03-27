# OZ AI — End-to-End Integration Diagram

## Complete System Flow

```
================================================================================
                   OZ AI — AI INTEGRATED LIBRARY SYSTEM
                        End-to-End Integration Flow
================================================================================


                                 USER LAYER
================================================================================

     STUDENT            INSTRUCTOR           STAFF              ADMIN
    +---------+        +---------+        +---------+        +---------+
    | Browser |        | Browser |        | Browser |        | Browser |
    +----+----+        +----+----+        +----+----+        +----+----+
         |                  |                  |                  |
         +--------+---------+--------+---------+--------+---------+
                  |
                  v
              +---+------------------------------+
              |          HTTPS Request            |
              |    Cookie: access_token=JWT       |
              +----------------+------------------+
                               |


================================================================================
                           FRONTEND LAYER (Next.js 14)
                              apps/web/
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                  app/dashboard/ai-assistant/page.tsx                         |
|------------------------------------------------------------------------------|
|                                                                              |
|  +-------------------+  +--------------------------------------------------+ |
|  | CONVERSATION      |  | CHAT PANEL                                       | |
|  | SIDEBAR           |  |                                                  | |
|  |                   |  | +-----------------------------------------+      | |
|  | [+ New Chat]      |  | | Message History (scrollable)            |      | |
|  |                   |  | |                                         |      | |
|  | > Chat about ML   |  | | User: "How many books do we have?"      |      | |
|  |   Chat about algo |  | |                                         |      | |
|  |   Research help   |  | | OZ AI: Let me check...                  |      | |
|  |                   |  | | [tool: get_catalog_stats]               |      | |
|  |                   |  | | We have **142 active books** with       |      | |
|  |                   |  | | 389 copies total. 201 are available     |      | |
|  |                   |  | | right now.                              |      | |
|  +-------------------+  | +-----------------------------------------+      | |
|                         |                                                  | |
|                         | +--------------------------------------+  [Send] | |
|                         | | Type a message...            [📎]   |         | |
|                         | +--------------------------------------+         | |
+------------------------------------------------------------------------------+
                               |
                               | SSE client reads token stream
                               | EventSource / ReadableStream
                               |
+------------------------------------------------------------------------------+
|                            lib/api.ts                                        |
|------------------------------------------------------------------------------|
|  POST /api/ai/chat  (Next.js proxy → NestJS)                                 |
|  { message, conversationId, image? }                                         |
|  Cookies forwarded automatically                                             |
+------------------------------------------------------------------------------+
                               |
                               | POST /ai/chat
                               | { message: "How many books do we have?" }
                               | Cookie: access_token=eyJhbG...
                               |


================================================================================
                           BACKEND LAYER (NestJS 10)
                              apps/api/
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                       AUTHENTICATION                                         |
|                  JwtAuthGuard (jwt.strategy.ts)                              |
|------------------------------------------------------------------------------|
|  Extract JWT from cookie → verify → attach user to request                  |
|  req.user = { id: 'usr_123', role: 'STUDENT' }                              |
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|                           AI CONTROLLER                                      |
|                       src/ai/ai.controller.ts                                |
|------------------------------------------------------------------------------|
|  @Post('chat')  @UseGuards(JwtAuthGuard)                                     |
|  @Sse() — returns Observable<MessageEvent>                                   |
|                                                                              |
|  → agentService.chatStream(userId, role, message, conversationId, cookie)   |
+------------------------------------------------------------------------------+
                               |
                               v


================================================================================
                         AGENTIC LOOP (AgentService)
                          src/ai/agent.service.ts
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|  STEP 1: BUILD SYSTEM PROMPT                                                 |
|------------------------------------------------------------------------------|
|  Prisma parallel queries:                                                    |
|    user profile + borrow policy + active borrows (titles + count)            |
|                                                                              |
|  System prompt includes:                                                     |
|    - Identity: "You are OZ AI..."                                            |
|    - User: name, role, faculty, interests, currently borrowed, borrow limits |
|    - Behaviour rules: always use tools, never hallucinate, English default   |
|    - Today's date                                                            |
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|  STEP 2: LOAD CONVERSATION HISTORY                                           |
|------------------------------------------------------------------------------|
|  prisma.aiMessage.findMany({ conversationId, take: 50 })                     |
|  → [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]|
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|  STEP 3: CALL OLLAMA WITH TOOLS                                              |
|------------------------------------------------------------------------------|
|                                                                              |
|  ollama.chat({                                                               |
|    model: 'mistral',                                                         |
|    messages: [ systemPrompt, ...history, userMessage ],                      |
|    tools: [ search_catalog, get_book_details, read_ebook, fetch_webpage,     |
|             get_my_borrows, get_catalog_stats, get_active_borrows,           |
|             get_active_reservations ],                                       |
|    stream: true,                                                             |
|  })                                                                          |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
               +---------------+------------------+
               |                                  |
               v                                  v
+-----------------------------+      +----------------------------+
|  RESPONSE: tool_call        |      |  RESPONSE: text token      |
|  { name, arguments }        |      |                            |
|                             |      |  yield token via SSE       |
|  executeTool(name, args,    |      |  → frontend renders it     |
|    userId, cookieHeader)    |      |    incrementally           |
|                             |      +----------------------------+
|  +------------------------+ |
|  | TOOL EXECUTION         | |
|  |                        | |
|  | search_catalog         | |
|  |  → GET /books?search=  | |
|  |                        | |
|  | get_catalog_stats      | |
|  |  → Prisma.book.count() | |
|  |    ×6 parallel         | |
|  |                        | |
|  | get_my_borrows         | |
|  |  → Prisma.borrow       | |
|  |    .findMany(userId)   | |
|  |                        | |
|  | get_active_borrows     | |
|  |  → Prisma + $queryRaw  | |
|  |    (top 5 by count)    | |
|  |                        | |
|  | read_ebook             | |
|  |  → fetch(url)          | |
|  |    strip HTML, 4000ch  | |
|  |                        | |
|  | fetch_webpage          | |
|  |  → fetch(url)          | |
|  |    strip HTML, 3000ch  | |
|  +------------------------+ |
|              |              |
|   inject tool result as     |
|   { role: 'tool' } message  |
|              |              |
|              └──────────────+──► loop back to Ollama
+-----------------------------+


================================================================================
                       STEP 4: PERSIST & STREAM COMPLETE
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|  Save to database:                                                           |
|    prisma.aiMessage.create({ role: 'user', content, conversationId })       |
|    prisma.aiMessage.create({ role: 'assistant', content, conversationId })  |
|                                                                              |
|  Update conversation title (if first message):                              |
|    title = first 50 chars of user message                                   |
+------------------------------------------------------------------------------+
                               |
                               | SSE stream ends
                               v


================================================================================
                           DATABASE LAYER
================================================================================

  +----------+  +----------+  +-----------+  +----------+  +----------------+
  |  users   |  |  books   |  | book_     |  | borrows  |  | ai_            |
  |          |  |          |  | copies    |  |          |  | conversations  |
  |----------|  |----------|  |-----------|  |----------|  |----------------|
  | id       |  | id       |  | id        |  | id       |  | id             |
  | email    |  | title    |  | bookId    |  | userId   |  | userId         |
  | name     |  | authors  |  | branchId  |  | bookCopy |  | title          |
  | role     |  | isbn     |  | status    |  | status   |  | createdAt      |
  | faculty  |  | category |  |           |  | dueAt    |  | updatedAt      |
  | interests|  | isEbook  |  |           |  |          |  +----------------+
  +----------+  +----------+  +-----------+  +----------+         |
                                                           +-------+--------+
                                                           | ai_messages    |
                                                           |----------------|
                                                           | id             |
                                                           | userId         |
                                                           | conversationId |
                                                           | role           |
                                                           | content        |
                                                           | createdAt      |
                                                           +----------------+


================================================================================
                         EXTERNAL SERVICES
================================================================================

  +------------------------------------------------------------------------+
  |                           OLLAMA                                       |
  |                     localhost:11434                                    |
  |------------------------------------------------------------------------|
  |                                                                        |
  |  Models:                                                               |
  |    mistral     — primary chat + tool calling (~4GB)                    |
  |    gemma3:4b   — book cover scanning, multimodal (~2GB)                |
  |                                                                        |
  |  Endpoints used:                                                       |
  |    POST /api/chat    — streaming chat with tools                       |
  |    POST /api/generate — cover scan (gemma3:4b, images array)          |
  |    GET  /api/tags    — health check / installed models                 |
  |                                                                        |
  |  Graceful degradation:                                                 |
  |    /ai/status → { available: false }                                   |
  |    Frontend shows "Basic Mode" amber pill                              |
  |    Agent stream returns error message to user                          |
  +------------------------------------------------------------------------+


================================================================================
                       SIMPLIFIED FLOW SUMMARY
================================================================================

  USER       FRONTEND          BACKEND          DATABASE        OLLAMA
   |             |                 |                |              |
   | type msg    |                 |                |              |
   |------------>|                 |                |              |
   |             | POST /ai/chat   |                |              |
   |             |---------------->|                |              |
   |             |                 | verify JWT     |              |
   |             |                 | build prompt   |              |
   |             |                 |--------------->|              |
   |             |                 |<---------------|              |
   |             |                 | load history   |              |
   |             |                 |--------------->|              |
   |             |                 |<---------------|              |
   |             |                 | call Ollama    |              |
   |             |                 |-------------------------------->
   |             |                 |       tool_call? get_catalog_stats
   |             |                 |<--------------------------------
   |             |                 | execute tool   |              |
   |             |                 |--------------->|              |
   |             |                 |<---------------|              |
   |             |                 | inject result  |              |
   |             |                 |-------------------------------->
   |             |                 |       stream tokens           |
   |             | SSE tokens      |<--------------------------------
   |             |<----------------|                |              |
   | renders     |                 |                |              |
   | incremental |                 | save messages  |              |
   |             |                 |--------------->|              |
   |             |                 |                |              |

  Typical latency:
    First token:  ~1-2s  (prompt build + first Ollama call)
    Tool calls:   +100-300ms each (DB) or +1-2s (web fetch)
    Full answer:  ~2-5s  (1-2 tool calls + generation)


================================================================================
                         FILE REFERENCE MAP
================================================================================

  FRONTEND (apps/web/)
  +-- app/
  |   +-- dashboard/
  |       +-- ai-assistant/
  |           +-- page.tsx --------------- Chat UI, SSE reader, conversation sidebar
  +-- app/api/ai/
  |   +-- chat/route.ts ---------------- Next.js proxy → NestJS (streams SSE)
  |   +-- conversations/route.ts ------- Next.js proxy → NestJS conversations
  |   +-- history/route.ts ------------- Next.js proxy → NestJS history
  +-- lib/
      +-- api.ts ------------------------ API client (fetchWithAuth + SSE)

  BACKEND (apps/api/)
  +-- src/
      +-- ai/
      |   +-- ai.module.ts --------------- Module definition
      |   +-- ai.controller.ts ----------- REST + SSE endpoints
      |   +-- agent.service.ts ----------- Agentic loop, tools, SSE, history
      |   +-- ai.service.ts -------------- Legacy orchestrator (still registered)
      |   +-- context-builder.service.ts - DB context (legacy path)
      |   +-- ollama.service.ts ---------- LLM calls + cover scan
      |   +-- dto/
      |       +-- chat.dto.ts ------------ { message, conversationId?, image? }
      |       +-- scan-cover.dto.ts ------- { image: base64 }
      +-- auth/guards/jwt-auth.guard.ts -- JWT verification

  DATABASE
  +-- apps/api/prisma/schema.prisma ------ AiConversation, AiMessage models


================================================================================
                         SECURITY CHECKPOINTS
================================================================================

  CHECKPOINT 1: Authentication
  ─────────────────────────────
  JwtAuthGuard on every /ai/* endpoint
  → 401 if cookie missing or token expired/invalid

  CHECKPOINT 2: Data Scoping
  ──────────────────────────
  get_my_borrows: WHERE userId = request.user.id (Prisma direct)
  get_history:    WHERE userId = request.user.id
  deleteConversation: WHERE id = :id AND userId = request.user.id

  CHECKPOINT 3: Role Guard
  ────────────────────────
  /ai/scan-cover: @Roles(Role.ADMIN) + RolesGuard
  → 403 for non-admin users

  CHECKPOINT 4: Prompt Boundaries
  ────────────────────────────────
  System prompt includes:
  "NEVER write Python, SQL, shell, or any code to answer a library question — call the tool."
  "NEVER use placeholder text like {{variable}} — always call the tool and use real data."
  "The AI informs but never executes write actions."

================================================================================
```
