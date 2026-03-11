# End-to-End AI Integration Diagram

## Complete System Overview

```
================================================================================
                         SMART LIBRARY MANAGEMENT SYSTEM
                            AI Integration Overview
================================================================================

                                 USER LAYER
================================================================================

     STUDENT            INSTRUCTOR           STAFF              ADMIN
    +---------+        +---------+        +---------+        +---------+
    | Browser |        | Browser |        | Browser |        | Browser |
    +----+----+        +----+----+        +----+----+        +----+----+
         |                  |                  |                  |
         +--------+---------+--------+---------+--------+---------+
                  |                            |
                  v                            v
              +---+----------------------------+---+
              |          HTTPS Request             |
              |    Cookie: access_token=JWT        |
              +----------------+-------------------+
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
|  +------------------------------------------------------------------------+  |
|  |                         CHAT INTERFACE                                 |  |
|  |  +------------------------------------------------------------------+  |  |
|  |  |  Message Input                                                   |  |  |
|  |  |  +------------------------------------------------------------+  |  |  |
|  |  |  | "Find books about machine learning"              [Send]   |  |  |  |
|  |  |  +------------------------------------------------------------+  |  |  |
|  |  +------------------------------------------------------------------+  |  |
|  |                                                                        |  |
|  |  +------------------------------------------------------------------+  |  |
|  |  |  Message History                                                 |  |  |
|  |  |  +------------------------------------------------------------+  |  |  |
|  |  |  |  User: "Find books about machine learning"                 |  |  |  |
|  |  |  |  --------------------------------------------------------  |  |  |  |
|  |  |  |  AI: Found 12 books matching "machine learning":          |  |  |  |
|  |  |  |                                                            |  |  |  |
|  |  |  |  1. "Deep Learning" by Ian Goodfellow                      |  |  |  |
|  |  |  |     [Available] 3 copies                                   |  |  |  |
|  |  |  |  2. "Hands-On Machine Learning" by Aurelien Geron         |  |  |  |
|  |  |  |     [Available] 2 copies                                   |  |  |  |
|  |  |  |                                                            |  |  |  |
|  |  |  |  [Model: qwen2.5] [Catalog] [Reading Lists]                |  |  |  |
|  |  |  +------------------------------------------------------------+  |  |  |
|  |  +------------------------------------------------------------------+  |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  State: { messages: [], loading: false, error: null }                        |
|  Handler: handleSendMessage() -> api.chat(message)                           |
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|                            lib/api.ts                                        |
|------------------------------------------------------------------------------|
|  export async function chat(message: string): Promise<ChatResponse> {        |
|    return fetchWithAuth('/ai/chat', {                                        |
|      method: 'POST',                                                         |
|      body: JSON.stringify({ message }),                                      |
|    });                                                                       |
|  }                                                                           |
|                                                                              |
|  // Cookies sent automatically (credentials: 'include')                      |
|  // Handles: 401 -> redirect to /login                                       |
+------------------------------------------------------------------------------+
                               |
                               | POST /ai/chat
                               | { message: "Find books about machine learning" }
                               | Cookie: access_token=eyJhbG...
                               |
================================================================================
                           BACKEND LAYER (NestJS 10)
                              apps/api/
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                            ENTRY POINT                                       |
|                            src/main.ts                                       |
|------------------------------------------------------------------------------|
|  - Global prefix: /api (but AI routes are /ai/*)                             |
|  - Cookie parser enabled                                                     |
|  - CORS configured for frontend origin                                       |
|  - Validation pipe (class-validator)                                         |
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|                       AUTHENTICATION LAYER                                   |
|                       src/auth/guards/jwt-auth.guard.ts                      |
|------------------------------------------------------------------------------|
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                         JwtAuthGuard                                   |  |
|  |------------------------------------------------------------------------|  |
|  |  1. Extract JWT from cookie: req.cookies['access_token']               |  |
|  |  2. Verify signature with JWT_SECRET                                   |  |
|  |  3. Decode payload: { sub: userId, role: 'STUDENT', email: '...' }     |  |
|  |  4. Attach to request: req.user = { id: userId, role: 'STUDENT' }      |  |
|  |                                                                        |  |
|  |  [PASS] Valid     -> Continue to controller                            |  |
|  |  [FAIL] Invalid   -> 401 Unauthorized                                  |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
                               | req.user = { id: 'usr_123', role: 'STUDENT' }
                               v
+------------------------------------------------------------------------------+
|                            AI MODULE                                         |
|                         src/ai/ai.module.ts                                  |
|------------------------------------------------------------------------------|
|  @Module({                                                                   |
|    imports: [UsersModule],                                                   |
|    controllers: [AiController],                                              |
|    providers: [                                                              |
|      AiService,              // Orchestrator                                 |
|      ContextBuilderService,  // DB context gatherer                          |
|      RoleResponseService,    // Rule-based fallback                          |
|      CatalogSearchService,   // Natural language search                      |
|      SemanticSearchService,  // Scoring & ranking                            |
|      LearningPathService,    // Learning path generator                      |
|      ResearchAssistantService, // Research guidance                          |
|      OllamaService,          // LLM integration                              |
|    ],                                                                        |
|  })                                                                          |
+------------------------------------------------------------------------------+
                               |
                               v
+------------------------------------------------------------------------------+
|                           AI CONTROLLER                                      |
|                       src/ai/ai.controller.ts                                |
|------------------------------------------------------------------------------|
|  @Controller('ai')                                                           |
|  @UseGuards(JwtAuthGuard)                                                    |
|  export class AiController {                                                 |
|                                                                              |
|    @Post('chat')                                                             |
|    chat(                                                                     |
|      @CurrentUser('id') userId: string,      // 'usr_123'                    |
|      @CurrentUser('role') userRole: Role,    // 'STUDENT'                    |
|      @Body() dto: ChatDto,                   // { message: "Find books..." } |
|    ) {                                                                       |
|      return this.aiService.chat(userId, userRole, dto.message);              |
|    }                                                                         |
|                                                                              |
|    @Patch('interests')   // Staff interest updates                           |
|    @Get('context')       // Debug: view AI context                           |
|  }                                                                           |
+------------------------------------------------------------------------------+
                               |
                               | aiService.chat('usr_123', 'STUDENT', 'Find books...')
                               |
================================================================================
                           AI SERVICE LAYER
                          src/ai/*.service.ts
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                    STEP 1: BUILD CONTEXT                                     |
|                 ContextBuilderService.build()                                |
|------------------------------------------------------------------------------|
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                    PARALLEL DATABASE QUERIES                           |  |
|  |                                                                        |  |
|  |  await Promise.all([                                                   |  |
|  |    prisma.user.findUnique({ id: userId }),        // User profile      |  |
|  |    prisma.borrowPolicy.findUnique({ role }),      // Borrow limits     |  |
|  |    prisma.borrow.findMany({ userId, ACTIVE }),    // Active borrows    |  |
|  |    prisma.reservation.count({ userId }),          // Reservations      |  |
|  |    prisma.book.count(),                           // Catalog stats     |  |
|  |    prisma.readingList.count({ PUBLISHED }),       // Reading lists     |  |
|  |    prisma.borrow.findMany({ userId, RETURNED }),  // Borrow history    |  |
|  |    // [ADMIN only] prisma.borrow.count({ OVERDUE }) // System stats    |  |
|  |  ]);                                                                   |  |
|  +------------------------------------------------------------------------+  |
|                               |                                              |
|                               v                                              |
|  +------------------------------------------------------------------------+  |
|  |                   ASSEMBLED CONTEXT (AiContext)                        |  |
|  |  {                                                                     |  |
|  |    user: { id, name: "John", role: "STUDENT", faculty: "Engineering" },|  |
|  |    borrowPolicy: { maxActiveBorrows: 5, maxBorrowDays: 14, ... },      |  |
|  |    activeBorrows: { count: 2, items: [{ title: "Clean Code", ... }] }, |  |
|  |    reservations: { count: 1, pending: 1, readyForPickup: 0 },          |  |
|  |    catalog: { totalBooks: 1500, availableCopies: 3200, ... },          |  |
|  |    readingLists: { publishedCount: 42, followedInstructors: 3, ... },  |  |
|  |    borrowHistory: { recentBooks: [...], totalBorrowed: 28 }            |  |
|  |  }                                                                     |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
                               | ctx: AiContext
                               v
+------------------------------------------------------------------------------+
|                       STEP 2: INTENT ROUTING                                 |
|                          AiService.chat()                                    |
|------------------------------------------------------------------------------|
|                                                                              |
|  message = "Find books about machine learning"                               |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                   INTENT DETECTION (Priority Order)                    |  |
|  |                                                                        |  |
|  |  1. Staff + No Interests?                                              |  |
|  |     -> NO (user is STUDENT)                                            |  |
|  |                                                                        |  |
|  |  2. Staff + Looks like interests?                                      |  |
|  |     -> NO (not staff)                                                  |  |
|  |                                                                        |  |
|  |  3. Non-Admin + Admin action?                                          |  |
|  |     -> NO ("find books" is not admin action)                           |  |
|  |                                                                        |  |
|  |  4. Catalog search query?                                              |  |
|  |     -> YES! "Find books about" matches search pattern                  |  |
|  |     -> ROUTE TO: CatalogSearchService.search()                         |  |
|  |                                                                        |  |
|  |  5. Learning path query?                                               |  |
|  |     -> (not evaluated - already routed)                                |  |
|  |                                                                        |  |
|  |  6. Research query?                                                    |  |
|  |     -> (not evaluated - already routed)                                |  |
|  |                                                                        |  |
|  |  7. General chat (Ollama)?                                             |  |
|  |     -> (not evaluated - already routed)                                |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
                               | Routed to: CatalogSearchService
                               v
+------------------------------------------------------------------------------+
|                      STEP 3: CATALOG SEARCH                                  |
|                    CatalogSearchService.search()                             |
|------------------------------------------------------------------------------|
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |  1. PARSE INTENT                                                       |  |
|  |     message: "Find books about machine learning"                       |  |
|  |     -> keywords: ["machine", "learning"]                               |  |
|  |     -> category: null                                                  |  |
|  |     -> availability: null                                              |  |
|  +------------------------------------------------------------------------+  |
|                               |                                              |
|                               v                                              |
|  +------------------------------------------------------------------------+  |
|  |  2. DATABASE QUERY                                                     |  |
|  |     prisma.book.findMany({                                             |  |
|  |       where: {                                                         |  |
|  |         OR: [                                                          |  |
|  |           { title: { contains: 'machine', mode: 'insensitive' } },     |  |
|  |           { title: { contains: 'learning', mode: 'insensitive' } },    |  |
|  |           { description: { contains: 'machine learning' } },           |  |
|  |           { subjectTags: { hasSome: ['machine learning', 'ML'] } },    |  |
|  |         ],                                                             |  |
|  |         isActive: true,                                                |  |
|  |       },                                                               |  |
|  |       include: { copies: true, mainFaculty: true },                    |  |
|  |       take: 20,                                                        |  |
|  |     })                                                                 |  |
|  +------------------------------------------------------------------------+  |
|                               |                                              |
|                               v                                              |
|  +------------------------------------------------------------------------+  |
|  |  3. SEMANTIC SCORING (SemanticSearchService)                           |  |
|  |                                                                        |  |
|  |  For each book:                                                        |  |
|  |    score = 0                                                           |  |
|  |    score += keywordMatchScore(title, description) * 0.40  // 40%       |  |
|  |    score += categoryMatchScore(category) * 0.20           // 20%       |  |
|  |    score += facultyRelevanceScore(faculty) * 0.15         // 15%       |  |
|  |    score += availabilityScore(copies) * 0.15              // 15%       |  |
|  |    score += recencyScore(publicationYear) * 0.10          // 10%       |  |
|  |                                                                        |  |
|  |  Results sorted by score descending -> Top 10 returned                 |  |
|  +------------------------------------------------------------------------+  |
|                               |                                              |
|                               v                                              |
|  +------------------------------------------------------------------------+  |
|  |  4. FORMAT RESPONSE                                                    |  |
|  |                                                                        |  |
|  |  Found 12 books matching "machine learning":                           |  |
|  |                                                                        |  |
|  |  1. "Deep Learning" by Ian Goodfellow                                  |  |
|  |     [Available] 3 copies | Engineering                                 |  |
|  |                                                                        |  |
|  |  2. "Hands-On Machine Learning" by Aurelien Geron                      |  |
|  |     [Available] 2 copies | Computer Science                            |  |
|  |                                                                        |  |
|  |  3. "Pattern Recognition" by Christopher Bishop                        |  |
|  |     [Reserved] 0 available (1 reserved)                                |  |
|  |                                                                        |  |
|  |  Browse all results in the [Catalog](/dashboard/catalog).              |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
+- - - - - - - - - - - - - - - + - - - - - - - - - - - - - - - - - - - - - - - +
|                                                                              |
|             ALTERNATIVE ROUTES (if different intent detected)                |
|                                                                              |
|  +------------------+  +------------------+  +------------------+            |
|  | LEARNING PATH    |  | RESEARCH ASSIST  |  | OLLAMA CHAT      |            |
|  | LearningPath     |  | ResearchAssistant|  | OllamaService    |            |
|  | Service          |  | Service          |  |                  |            |
|  |                  |  |                  |  |                  |            |
|  | Trigger:         |  | Trigger:         |  | Trigger:         |            |
|  | "learning path"  |  | "research on"    |  | general query    |            |
|  |                  |  |                  |  |                  |            |
|  | Output:          |  | Output:          |  | Output:          |            |
|  | ## Learning Path |  | ## Research      |  | Natural language |            |
|  | ### Stage 1      |  | ### Books        |  | using role-      |            |
|  | - Book 1, Book 2 |  | - Book 1, Book 2 |  | specific prompt  |            |
|  | ### Stage 2      |  | ### Reading Lists|  |                  |            |
|  | - Book 3, Book 4 |  | - List 1, List 2 |  | Falls back to:   |            |
|  | ### Stage 3      |  | ### Materials    |  | RoleResponse     |            |
|  | - Book 5, Book 6 |  | - Paper 1        |  | Service          |            |
|  +------------------+  +------------------+  +------------------+            |
|                                                                              |
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
                               |
                               v
+------------------------------------------------------------------------------+
|                      STEP 4: ASSEMBLE RESPONSE                               |
|------------------------------------------------------------------------------|
|                                                                              |
|  ChatResponse {                                                              |
|    reply: "Found 12 books matching \"machine learning\":\n\n1. ...",         |
|    modelUsed: "rule-based",  // or "qwen2.5" if Ollama enhanced              |
|    sources: ["/dashboard/catalog", "/dashboard/reading-lists"]               |
|  }                                                                           |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
================================================================================
                           DATABASE LAYER
                      PostgreSQL + Prisma ORM
================================================================================
                               |
+------------------------------------------------------------------------------+
|                                                                              |
|  +----------+  +----------+  +----------+  +----------+  +----------+        |
|  |  users   |  |  books   |  |book_copies|  | borrows  |  |reservations|      |
|  |----------|  |----------|  |----------|  |----------|  |----------|        |
|  | id       |  | id       |  | id       |  | id       |  | id       |        |
|  | email    |  | title    |  | bookId   |  | userId   |  | userId   |        |
|  | name     |  | authors  |  | branchId |  | bookCopyId|  | bookCopyId|       |
|  | role     |<-| facultyId|<-| status   |<-| status   |  | status   |        |
|  | facultyId|  | category |  |          |  | dueAt    |  | expiresAt|        |
|  | interests|  | tags     |  |          |  | returnedAt|  |          |        |
|  +----------+  +----------+  +----------+  +----------+  +----------+        |
|       |             |             |             |                            |
|       v             v             v             v                            |
|  +----------+  +----------+  +----------+  +----------+                      |
|  | faculties|  |reading_  |  |reading_  |  |borrow_   |                      |
|  |          |  |lists     |  |list_items|  |policies  |                      |
|  +----------+  +----------+  +----------+  +----------+                      |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
================================================================================
                         EXTERNAL SERVICES
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                              OLLAMA                                          |
|                        localhost:11434                                       |
|------------------------------------------------------------------------------|
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                       MODEL SELECTION                                  |  |
|  |                                                                        |  |
|  |  +------------+     +------------+     +------------+                  |  |
|  |  |   phi3     |     |  qwen2.5   |     |   llama3   |                  |  |
|  |  |  (~2GB)    |     |  (~4GB)    |     |  (~4GB)    |                  |  |
|  |  |------------|     |------------|     |------------|                  |  |
|  |  | - Fast     |     | - Balanced |     | - Capable  |                  |  |
|  |  | - Simple Q |     | - Student  |     | - Complex  |                  |  |
|  |  | - Staff    |     | - Instructor|    | - Admin    |                  |  |
|  |  +------------+     +------------+     +------------+                  |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                       API ENDPOINTS                                    |  |
|  |                                                                        |  |
|  |  POST /api/generate                                                    |  |
|  |  {                                                                     |  |
|  |    "model": "qwen2.5",                                                 |  |
|  |    "prompt": "User: Find me books about AI",                           |  |
|  |    "system": "You are a library assistant. Context: ...",              |  |
|  |    "stream": false                                                     |  |
|  |  }                                                                     |  |
|  |                                                                        |  |
|  |  GET /api/tags  (health check / model list)                            |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                    GRACEFUL DEGRADATION                                |  |
|  |                                                                        |  |
|  |  IF Ollama unavailable:                                                |  |
|  |    -> OllamaService.generate() throws error                            |  |
|  |       -> AiService catches error                                       |  |
|  |          -> Falls back to RoleResponseService.respond()                |  |
|  |             -> Returns rule-based response                             |  |
|  |                -> modelUsed: "rule-based"                              |  |
|  |                                                                        |  |
|  |  User experience: Seamless (may notice less natural responses)         |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+
                               |
================================================================================
                           RESPONSE FLOW
================================================================================
                               |
                               v
+------------------------------------------------------------------------------+
|                                                                              |
|  Backend Response:                                                           |
|  {                                                                           |
|    "reply": "Found 12 books matching \"machine learning\":\n\n1. ...",       |
|    "modelUsed": "qwen2.5",                                                   |
|    "sources": ["/dashboard/catalog", "/dashboard/reading-lists"]             |
|  }                                                                           |
|                               |                                              |
|                               | HTTP 200 JSON                                |
|                               v                                              |
|                                                                              |
|  Frontend Processing (lib/api.ts):                                           |
|  const response = await fetchWithAuth('/ai/chat', { ... });                  |
|  return response.json(); // ChatResponse                                     |
|                               |                                              |
|                               | ChatResponse object                          |
|                               v                                              |
|                                                                              |
|  React State Update (page.tsx):                                              |
|  setMessages([...messages, {                                                 |
|    role: 'assistant',                                                        |
|    content: response.reply,                                                  |
|    model: response.modelUsed                                                 |
|  }]);                                                                        |
|                               |                                              |
|                               | Re-render                                    |
|                               v                                              |
|                                                                              |
|  UI Rendering:                                                               |
|  +------------------------------------------------------------------------+  |
|  |  Found 12 books matching "machine learning":                           |  |
|  |                                                                        |  |
|  |  1. "Deep Learning" by Ian Goodfellow                                  |  |
|  |     [Available] 3 copies | Engineering                                 |  |
|  |                                                                        |  |
|  |  2. "Hands-On Machine Learning" by Aurelien Geron                      |  |
|  |     [Available] 2 copies | Computer Science                            |  |
|  |                                                                        |  |
|  |  [Model: qwen2.5] [Catalog] [Reading Lists]  <- Clickable badges       |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+------------------------------------------------------------------------------+


================================================================================
                         SIMPLIFIED FLOW SUMMARY
================================================================================

    USER          FRONTEND           BACKEND              DATABASE          OLLAMA
     |               |                  |                    |                |
     |  Type msg     |                  |                    |                |
     |-------------->|                  |                    |                |
     |               |  POST /ai/chat   |                    |                |
     |               |----------------->|                    |                |
     |               |                  |  Verify JWT        |                |
     |               |                  |-----------------> |                |
     |               |                  | <-----------------|                |
     |               |                  |                    |                |
     |               |                  |  Build Context     |                |
     |               |                  |-----------------> |                |
     |               |                  | <-----------------|                |
     |               |                  |   (user, borrows,  |                |
     |               |                  |    reservations,   |                |
     |               |                  |    catalog stats)  |                |
     |               |                  |                    |                |
     |               |                  |  Route Intent      |                |
     |               |                  |  ---------------   |                |
     |               |                  |  (keyword match)   |                |
     |               |                  |                    |                |
     |               |                  |  Search Catalog    |                |
     |               |                  |-----------------> |                |
     |               |                  | <-----------------|                |
     |               |                  |                    |                |
     |               |                  |  [Optional] LLM    |                |
     |               |                  |----------------------------------->|
     |               |                  | <----------------------------------|
     |               |                  |                    |                |
     |               |                  |  Format Response   |                |
     |               |  ChatResponse    |                    |                |
     |               |<-----------------|                    |                |
     |  Display msg  |                  |                    |                |
     |<--------------|                  |                    |                |
     |               |                  |                    |                |

    Total time: ~200ms (rule-based) to ~3s (Ollama)


================================================================================
                         FILE REFERENCE MAP
================================================================================

  FRONTEND (apps/web/)
  +-- app/
  |   +-- dashboard/
  |       +-- ai-assistant/
  |           +-- page.tsx --------------- Chat UI component
  +-- lib/
  |   +-- api.ts ------------------------- API client (fetchWithAuth)
  +-- types/
      +-- index.ts ----------------------- TypeScript interfaces

  BACKEND (apps/api/)
  +-- src/
      +-- ai/
      |   +-- ai.module.ts --------------- Module definition
      |   +-- ai.controller.ts ----------- REST endpoints
      |   +-- ai.service.ts -------------- Orchestrator + intent router
      |   +-- context-builder.service.ts - Database context gatherer
      |   +-- role-response.service.ts --- Rule-based fallback
      |   +-- catalog-search.service.ts -- Natural language search
      |   +-- semantic-search.service.ts - Scoring & ranking
      |   +-- learning-path.service.ts --- Learning path generator
      |   +-- research-assistant.service.ts - Research guidance
      |   +-- ollama.service.ts ---------- LLM integration
      |   +-- dto/
      |       +-- chat.dto.ts ------------ Chat request validation
      |       +-- update-interests.dto.ts  Interests update validation
      +-- auth/
      |   +-- guards/
      |   |   +-- jwt-auth.guard.ts ------ JWT verification
      |   +-- decorators/
      |       +-- current-user.decorator.ts - Extract user from request
      +-- prisma/
          +-- prisma.service.ts ---------- Database client

  DATABASE
  +-- apps/api/prisma/
      +-- schema.prisma ------------------ All table definitions

  CONFIGURATION
  +-- apps/api/.env ---------------------- OLLAMA_BASE_URL, JWT_SECRET
  +-- apps/web/.env ---------------------- NEXT_PUBLIC_API_URL


================================================================================
                       SECURITY & PERMISSION FLOW
================================================================================

  +------------------------------------------------------------------------+
  | CHECKPOINT 1: Authentication (JwtAuthGuard)                            |
  |                                                                        |
  |   Request --> Extract JWT from cookie                                  |
  |           --> Verify signature with JWT_SECRET                         |
  |           --> Check expiration                                         |
  |           --> Attach user to request                                   |
  |                                                                        |
  |   [PASS] Valid: Continue to controller                                 |
  |   [FAIL] Invalid: 401 Unauthorized                                     |
  +------------------------------------------------------------------------+
                          |
                          v
  +------------------------------------------------------------------------+
  | CHECKPOINT 2: Context Isolation (ContextBuilderService)                |
  |                                                                        |
  |   - User can only see their own data                                   |
  |   - Borrows: WHERE userId = currentUser.id                             |
  |   - Reservations: WHERE userId = currentUser.id                        |
  |   - Admin stats: Only if role === ADMIN                                |
  |                                                                        |
  |   No cross-user data leakage possible                                  |
  +------------------------------------------------------------------------+
                          |
                          v
  +------------------------------------------------------------------------+
  | CHECKPOINT 3: Permission Gate (AiService)                              |
  |                                                                        |
  |   Non-admin user asks: "Delete user john@test.com"                     |
  |                                                                        |
  |   isAdminAction() detects: "delete user" -> true                       |
  |                                                                        |
  |   Response:                                                            |
  |   "That action requires administrator privileges. As a student,        |
  |    you can: Browse Catalog, Manage Borrows, Explore Reading Lists..."  |
  |                                                                        |
  |   Action blocked before reaching any service                           |
  +------------------------------------------------------------------------+
                          |
                          v
  +------------------------------------------------------------------------+
  | CHECKPOINT 4: Prompt Boundaries (System Prompts)                       |
  |                                                                        |
  |   All system prompts include:                                          |
  |   "Do not perform administrative actions - only provide information    |
  |    and guidance."                                                      |
  |                                                                        |
  |   Role-specific boundaries:                                            |
  |   - Student: "Help the student find books, manage borrows..."          |
  |   - Admin: "Never execute actions - only inform"                       |
  |                                                                        |
  |   LLM guided to stay within scope                                      |
  +------------------------------------------------------------------------+


================================================================================
                      PERFORMANCE CHARACTERISTICS
================================================================================

  REQUEST TYPE               AVG LATENCY        COMPONENTS INVOLVED
  -------------------------------------------------------------------------

  Rule-based response        ~100-200ms         JWT verify + DB context +
  (borrowing limits, etc.)                      keyword match

  Catalog search             ~300-500ms         JWT + DB context + catalog
  (find books about...)                         query + scoring + formatting

  Learning path              ~500-800ms         JWT + DB context + catalog
  (without LLM)                                 search + classification

  Learning path              ~2-4s              Above + Ollama generate
  (with LLM enhancement)                        (stage descriptions)

  General chat (phi3)        ~1-2s              JWT + DB context + LLM
  (simple queries)

  General chat (qwen2.5)     ~2-3s              JWT + DB context + LLM
  (balanced queries)

  General chat (llama3)      ~3-5s              JWT + DB context + LLM
  (complex/admin queries)

  -------------------------------------------------------------------------

  DATABASE QUERIES PER REQUEST (Context Building)
  -------------------------------------------------------------------------
  - User profile: 1 query
  - Borrow policy: 1 query
  - Active borrows: 2 queries (count + items)
  - Reservations: 3 queries (count + pending + ready)
  - Catalog stats: 3 queries (count + available + categories)
  - Reading lists: 3 queries (published + followed + own)
  - Borrow history: 2 queries (recent + total)
  - [Admin] System stats: 4 queries

  Total: 15-19 queries (executed in parallel via Promise.all)
  Typical DB time: ~50-100ms

================================================================================
```
