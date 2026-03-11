# AI Architecture Document

## Overview

The AI module transforms a traditional library management system into a **Smart Library Management System** by providing:
- Natural language interaction
- Role-aware personalized responses
- Live context from the library database
- Graceful degradation when LLM is unavailable

---

## High-Level Architecture

```
                              USER LAYER
    +----------+    +------------+    +----------+    +----------+
    | STUDENT  |    | INSTRUCTOR |    |   STAFF  |    |  ADMIN   |
    +----+-----+    +-----+------+    +----+-----+    +----+-----+
         |               |                 |               |
         +-------+-------+--------+--------+-------+-------+
                 |                         |
                 v                         v
         +-------+-------------------------+-------+
         |              HTTPS Request              |
         |      Cookie: access_token=JWT           |
         +-------------------+---------------------+
                             |
                             v
         +-------------------+---------------------+
         |           FRONTEND (Next.js 14)         |
         |           apps/web/                     |
         |  +------------------------------------+ |
         |  | app/dashboard/ai-assistant/page   | |
         |  | - Chat UI with message history    | |
         |  | - Markdown rendering              | |
         |  | - Source links as badges          | |
         |  +------------------------------------+ |
         |  +------------------------------------+ |
         |  | lib/api.ts                        | |
         |  | - fetchWithAuth('/ai/chat')       | |
         |  +------------------------------------+ |
         +-------------------+---------------------+
                             |
                             | POST /ai/chat
                             | { message: string }
                             v
         +-------------------+---------------------+
         |           BACKEND (NestJS 10)           |
         |           apps/api/                     |
         |  +------------------------------------+ |
         |  | JwtAuthGuard                       | |
         |  | - Extract JWT from cookie          | |
         |  | - Verify signature                 | |
         |  | - Attach user to request           | |
         |  +------------------------------------+ |
         |                   |                     |
         |                   v                     |
         |  +------------------------------------+ |
         |  | AiController                       | |
         |  | POST /chat -> AiService.chat()    | |
         |  +------------------------------------+ |
         +-------------------+---------------------+
                             |
                             v
         +-------------------+---------------------+
         |              AI SERVICE LAYER           |
         |  +------------------------------------+ |
         |  | ContextBuilderService              | |
         |  | - Gathers live DB context          | |
         |  +------------------------------------+ |
         |                   |                     |
         |                   v                     |
         |  +------------------------------------+ |
         |  | AiService (Orchestrator)           | |
         |  | - Intent routing                   | |
         |  | - Coordinates specialized services | |
         |  +------------------------------------+ |
         |         |         |         |           |
         |         v         v         v           |
         |  +----------+ +--------+ +----------+   |
         |  | Catalog  | |Learning| | Research |   |
         |  | Search   | | Path   | | Assistant|   |
         |  +----------+ +--------+ +----------+   |
         |         |         |         |           |
         |         +----+----+----+----+           |
         |              |         |                |
         |              v         v                |
         |  +------------------------------------+ |
         |  | OllamaService    RoleResponseService|
         |  | (LLM)            (Rule-based)       |
         |  +------------------------------------+ |
         +-------------------+---------------------+
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

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ai/chat` | POST | Main chat endpoint |
| `/ai/interests` | PATCH | Update user interests |
| `/ai/context` | GET | Debug: view AI context |

- Protected by `JwtAuthGuard`
- Extracts `userId` and `userRole` from JWT
- Swagger documented

### AiService (`ai.service.ts`)

**Role**: Central orchestrator and intent router

```
chat(userId, userRole, message)
    |
    +-> ContextBuilderService.build()
    |
    +-> Intent Detection (priority order):
        |
        +-> Staff Interest Bootstrap
        +-> Staff Interest Update
        +-> Admin Permission Gate
        +-> Catalog Search (CatalogSearchService)
        +-> Learning Path (LearningPathService)
        +-> Research Query (ResearchAssistantService)
        +-> General Chat (OllamaService + RoleResponseService fallback)
```

### ContextBuilderService (`context-builder.service.ts`)

**Role**: Gather live data from database for each request

| Data Gathered | Source |
|---------------|--------|
| User profile | `users` table |
| Borrow policy | `borrow_policies` table |
| Active borrows | `borrows` WHERE status=ACTIVE |
| Reservations | `reservations` table |
| Catalog stats | `books` + `book_copies` |
| Reading lists | `reading_lists` table |
| Borrow history | `borrows` WHERE status=RETURNED |
| Admin stats | System-wide aggregates (ADMIN only) |

### OllamaService (`ollama.service.ts`)

**Role**: LLM integration with role-based model selection

| Role | Default Model | Deep Reasoning |
|------|---------------|----------------|
| STAFF | phi3 | llama3 |
| STUDENT | qwen2.5 | llama3 |
| INSTRUCTOR | qwen2.5 | llama3 |
| ADMIN | llama3 | llama3 |

### RoleResponseService (`role-response.service.ts`)

**Role**: Rule-based fallback when Ollama unavailable

- Keyword-based response matching per role
- Handles common queries without LLM
- Provides structured responses with sources

### CatalogSearchService (`catalog-search.service.ts`)

**Role**: Natural language to catalog search

- Parses intent (keywords, category, availability)
- Builds dynamic Prisma query
- Applies semantic scoring
- Returns formatted book list

### SemanticSearchService (`semantic-search.service.ts`)

**Role**: Multi-factor book scoring and ranking

| Factor | Weight |
|--------|--------|
| Keyword match | 40% |
| Category match | 20% |
| Faculty relevance | 15% |
| Availability | 15% |
| Recency | 10% |

### LearningPathService (`learning-path.service.ts`)

**Role**: Generate structured learning paths

- Groups books into difficulty levels
- Stages: Foundations -> Core -> Advanced
- Considers user's borrow history

### ResearchAssistantService (`research-assistant.service.ts`)

**Role**: Research guidance and literature discovery

- Searches books, reading lists, and materials
- Provides role-specific guidance
- Optionally generates literature landscape via Ollama

---

## Intent Routing Flow

```
                         User Message
                              |
                              v
                    +-------------------+
                    | Build Live Context|
                    +-------------------+
                              |
                              v
+------------------------------------------------------------------+
|                       INTENT ROUTER                               |
+------------------------------------------------------------------+
|                              |                                    |
|  1. Staff + No Interests?    |                                    |
|     +-> YES: Return bootstrap prompt                              |
|     +-> NO: Continue                                              |
|                              |                                    |
|  2. Staff + Looks like interests?                                 |
|     +-> YES: Save interests, return confirmation                  |
|     +-> NO: Continue                                              |
|                              |                                    |
|  3. Non-Admin + Admin action?                                     |
|     +-> YES: Return permission denied message                     |
|     +-> NO: Continue                                              |
|                              |                                    |
|  4. Catalog search query?                                         |
|     ("find books", "search for", "available books")               |
|     +-> YES: Route to CatalogSearchService                        |
|     +-> NO: Continue                                              |
|                              |                                    |
|  5. Learning path query?                                          |
|     ("learning path", "study plan", "what should I read")         |
|     +-> YES: Route to LearningPathService                         |
|     +-> NO: Continue                                              |
|                              |                                    |
|  6. Research query?                                               |
|     ("research on", "thesis about", "literature on")              |
|     +-> YES: Route to ResearchAssistantService                    |
|     +-> NO: Continue                                              |
|                              |                                    |
|  7. General query                                                 |
|     +-> Try OllamaService                                         |
|         +-> Success: Return LLM response                          |
|         +-> Failure: Fallback to RoleResponseService              |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Data Flow: Request to Response

```
1. USER INPUT
   "Find books about machine learning"
              |
              v
2. FRONTEND (Next.js)
   - User types message
   - handleSendMessage()
   - api.chat(message)
   - POST /ai/chat with JWT cookie
              |
              v
3. AUTHENTICATION (JwtAuthGuard)
   - Extract JWT from cookie
   - Verify signature
   - Decode: { sub: userId, role: 'STUDENT' }
   - Attach to request
              |
              v
4. CONTROLLER (AiController)
   - @CurrentUser('id') -> userId
   - @CurrentUser('role') -> userRole
   - Call aiService.chat(userId, userRole, message)
              |
              v
5. CONTEXT BUILDING (ContextBuilderService)
   - Query user profile
   - Query borrow policy
   - Query active borrows
   - Query reservations
   - Query catalog stats
   - Query reading lists
   - Query borrow history
   - [ADMIN] Query system stats
   - Return AiContext object
              |
              v
6. INTENT ROUTING (AiService)
   - "Find books about" matches search pattern
   - Route to CatalogSearchService
              |
              v
7. CATALOG SEARCH (CatalogSearchService)
   - Parse: keywords=["machine", "learning"]
   - Query database for matching books
   - Apply semantic scoring
   - Format as markdown
              |
              v
8. RESPONSE ASSEMBLY
   {
     reply: "Found 12 books...",
     modelUsed: "rule-based",
     sources: ["/dashboard/catalog"]
   }
              |
              v
9. FRONTEND RENDERING
   - Receive ChatResponse
   - Update message state
   - Render markdown
   - Display source badges
```

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
   | UsersModule |  |PrismaModule |  | (internal)  |
   +-------------+  +-------------+  +-------------+
                                            |
            +-------+-------+-------+-------+-------+-------+
            |       |       |       |       |       |       |
            v       v       v       v       v       v       v
        +-----+ +-----+ +-----+ +-----+ +-----+ +-----+ +-----+
        | Ai  | |Ctxt | |Role | |Cat  | |Sem  | |Lrn  | |Res  |
        | Svc | |Bldr | |Resp | |Srch | |Srch | |Path | |Asst |
        +-----+ +-----+ +-----+ +-----+ +-----+ +-----+ +-----+
            |                                               |
            +-------------------+---------------------------+
                                |
                                v
                         +------+------+
                         |OllamaService|
                         +-------------+
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/ai/ai.module.ts` | Module definition |
| `src/ai/ai.controller.ts` | REST endpoints |
| `src/ai/ai.service.ts` | Orchestrator |
| `src/ai/context-builder.service.ts` | DB context gatherer |
| `src/ai/role-response.service.ts` | Rule-based fallback |
| `src/ai/catalog-search.service.ts` | Natural language search |
| `src/ai/semantic-search.service.ts` | Book scoring |
| `src/ai/learning-path.service.ts` | Learning path generator |
| `src/ai/research-assistant.service.ts` | Research guidance |
| `src/ai/ollama.service.ts` | LLM integration |
| `src/ai/dto/chat.dto.ts` | Chat request DTO |
| `src/ai/dto/update-interests.dto.ts` | Interests DTO |
