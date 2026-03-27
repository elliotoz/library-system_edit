# OZ AI — Technical Deep-Dive

## System Prompt

The system prompt is built dynamically per request in `AgentService.buildSystemPrompt()`. It is personalised to the specific user making the request.

### Structure

```
You are OZ AI — the AI assistant for AI Integrated Library System.
You are smart, academic, friendly, and precise.
Respond in English by default. Only switch to Turkish if the user's message is written in Turkish.

## Current User
Name: {user.name}
Role: {user.role}
Faculty: {user.faculty.name}
Interests: {user.interests}
Currently Borrowed: {book titles}
Active Borrows: {count} / {maxActiveBorrows} max
Borrow Policy: {maxBorrowDays} days, {maxExtensions} extensions

## Your Capabilities
You have tools to search the library catalog, count catalog stats, get book details,
read and summarise e-books, fetch web pages, check your own borrows, and — for staff/admin —
view all active borrows and reservations across the library.
You have direct, real-time access to the library database through these tools.

## Behaviour Rules
- ALWAYS use a tool to answer library data questions. NEVER guess or invent numbers.
- To count books: call get_catalog_stats — it returns exact totals from the database.
- To find a book by name: call search_catalog with the book title as the query.
- When the user says "find/get/fetch [name]", treat [name] as a book title and call search_catalog.
- When books are returned by any tool, always render the title as a markdown link: [Title](link)
- To see active borrows or the most-borrowed book: call get_active_borrows.
- To see active reservations: call get_active_reservations.
- NEVER write Python, SQL, shell, or any code to answer a library question — call the tool.
- NEVER use placeholder text like {{variable}} or <result> — always call the tool and use real data.
- For code questions (user explicitly asking to write code), reply with a code block only.
- When summarising a book, call read_ebook first — never invent summaries.
- When the user sends an image, describe what you see in detail, then answer their question.
- Use markdown: bullet points for lists, headings for long answers, fenced code blocks for code.
- Be concise. Today is {date}.
```

### Data Queries for Prompt

Three parallel Prisma queries run before every chat call:

```typescript
await Promise.all([
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name, role, interests, faculty: { select: { name } } }
  }),
  prisma.borrowPolicy.findUnique({ where: { role } }),
  prisma.borrow.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { bookCopy: { include: { book: { select: { title } } } } }
  }),
]);
```

**DB time**: ~20–50ms (3 queries, parallel)

---

## Agentic Loop

The core loop in `chatStream()` is an async generator that yields SSE tokens:

```typescript
async *chatStream(userId, role, message, conversationId?, cookieHeader?): AsyncGenerator<string> {
  // 1. Build system prompt
  const systemPrompt = await this.buildSystemPrompt(userId);

  // 2. Load conversation history
  const history = await this.getHistory(userId, conversationId);
  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // 3. Agentic loop
  let fullResponse = '';
  while (true) {
    const stream = await this.ollama.chat({
      model: 'mistral',
      messages,
      tools: this.getTools(),
      stream: true,
    });

    let toolCalls = [];
    for await (const chunk of stream) {
      if (chunk.message.tool_calls?.length) {
        toolCalls = chunk.message.tool_calls;
      } else if (chunk.message.content) {
        fullResponse += chunk.message.content;
        yield chunk.message.content;  // SSE token
      }
    }

    if (!toolCalls.length) break;  // no more tool calls → done

    // Execute tools and inject results
    for (const call of toolCalls) {
      const result = await this.executeTool(call.function.name, call.function.arguments, userId, cookieHeader);
      messages.push({ role: 'tool', content: result });
    }
    // loop back to Ollama with tool results
  }

  // 4. Persist messages
  await this.saveMessage(userId, 'user', message, conversationId);
  await this.saveMessage(userId, 'assistant', fullResponse, conversationId);
}
```

---

## Tool Definitions

Each tool is an Ollama `Tool` object injected into the chat call.

### search_catalog

```typescript
{
  name: 'search_catalog',
  description: 'Search the library catalog by title, author, subject or keyword. Always call this before recommending a book.',
  parameters: {
    query: { type: 'string' },       // required
    pageSize: { type: 'number' },    // default 5, max 10
  }
}
```

Implementation: `GET /books?search={query}&pageSize={n}` via internal HTTP call with the user's session cookie forwarded.

Returns: `{ total, results: [{ id, title, authors, isEbook, available, copies, link, description }] }`

### get_book_details

```typescript
{
  name: 'get_book_details',
  description: 'Get full details for a specific book including availability and e-book link.',
  parameters: { bookId: { type: 'string' } }
}
```

Implementation: `GET /books/:bookId`

### read_ebook

```typescript
{
  name: 'read_ebook',
  description: 'Fetch and read an e-book from its URL. Use to summarise or answer questions about book content.',
  parameters: {
    url: { type: 'string' },
    question: { type: 'string' },
  }
}
```

Implementation: `fetch(url)` with 15s timeout, strips HTML tags, returns first 4000 characters.

### fetch_webpage

```typescript
{
  name: 'fetch_webpage',
  description: 'Fetch any public URL. Use for Wikipedia, academic papers, or URLs the user provides.',
  parameters: {
    url: { type: 'string' },
    purpose: { type: 'string' },
  }
}
```

Implementation: `fetch(url)` with 10s timeout, strips HTML, returns first 3000 characters.

### get_my_borrows

```typescript
{
  name: 'get_my_borrows',
  description: "Get the current user's own active borrows and due dates.",
  parameters: {}
}
```

Implementation: Direct Prisma query scoped to `userId`. Returns `[{ title, dueDate, daysLeft, isOverdue }]`.

### get_catalog_stats

```typescript
{
  name: 'get_catalog_stats',
  description: 'Get total book count, copy counts, and e-book count. Use for "how many books" questions.',
  parameters: {}
}
```

Implementation: 6 parallel Prisma counts in `Promise.all()`:

```typescript
const [totalBooks, totalCopies, availableCopies, borrowedCopies, ebookCount, activeBorrows] =
  await Promise.all([
    prisma.book.count({ where: { isActive: true } }),
    prisma.bookCopy.count(),
    prisma.bookCopy.count({ where: { status: 'AVAILABLE' } }),
    prisma.bookCopy.count({ where: { status: 'BORROWED' } }),
    prisma.book.count({ where: { isEbookAvailable: true } }),
    prisma.borrow.count({ where: { status: 'ACTIVE' } }),
  ]);
```

### get_active_borrows

```typescript
{
  name: 'get_active_borrows',
  description: 'All active borrows + top 5 most-borrowed books of all time.',
  parameters: {}
}
```

Implementation: Prisma `findMany` (status=ACTIVE, last 20, sorted by dueAt) + `$queryRaw` for most-borrowed aggregation:

```sql
SELECT b.title, COUNT(br.id) AS borrow_count
FROM borrows br
JOIN book_copies bc ON bc.id = br."bookCopyId"
JOIN books b ON b.id = bc."bookId"
GROUP BY b.id, b.title
ORDER BY borrow_count DESC
LIMIT 5
```

Note: `$queryRaw` returns `bigint` for `COUNT` — results are converted with `.toString()` before JSON serialisation.

### get_active_reservations

```typescript
{
  name: 'get_active_reservations',
  description: 'All active (pending or ready for pickup) reservations.',
  parameters: {}
}
```

Implementation: Prisma `findMany` with `status: { in: ['PENDING', 'READY_FOR_PICKUP'] }`, includes book title, user name/role, branch name.

---

## Book Cover Scanning

`OllamaService.scanBookCover(base64: string)` sends the image to Ollama using `gemma3:4b` (multimodal):

```typescript
const response = await fetch(`${this.baseUrl}/api/generate`, {
  method: 'POST',
  body: JSON.stringify({
    model: 'gemma3:4b',
    prompt: 'Extract from this book cover: title, authors (array), isbn, publisher, year. Return valid JSON only.',
    images: [base64],
    stream: false,
  }),
});
```

The response text is parsed as JSON. The admin book form receives `{ title, authors, isbn, publisher, year }` and auto-fills the input fields.

DTO validation: `base64` string, max 2MB cap enforced in `ScanCoverDto`.

---

## SSE Streaming

The controller uses NestJS `@Sse()` decorator returning an `Observable<MessageEvent>`:

```typescript
@Post('chat')
@Sse()
chat(@CurrentUser('id') userId, @Body() dto, @Headers('cookie') cookie, @Res() res): Observable<MessageEvent> {
  return new Observable(subscriber => {
    (async () => {
      for await (const token of this.agentService.chatStream(userId, dto.message, dto.conversationId, cookie)) {
        subscriber.next({ data: token });
      }
      subscriber.complete();
    })();
  });
}
```

The frontend reads tokens via the browser `EventSource` API (or `fetch` with `ReadableStream`) and appends each token to the message display in real time.

---

## Conversation Persistence

```
POST /ai/conversations        → create new AiConversation
GET  /ai/conversations        → list user's conversations (id, title, timestamps)
DELETE /ai/conversations/:id  → delete (scoped: WHERE id AND userId)
GET  /ai/history?conversationId=  → paginated AiMessage records (take: 50)
```

All `chatStream()` calls save user + assistant messages after the stream completes. The conversation title is set to the first 50 characters of the first user message.

---

## Security

### Authentication

Every `/ai/*` endpoint is protected by `JwtAuthGuard`. The guard:
1. Extracts `access_token` from the HttpOnly cookie
2. Verifies the JWT signature with `JWT_SECRET`
3. Checks expiration
4. Attaches `{ id, role, email }` to `request.user`

### Data Scoping

| Operation | Scope |
|-----------|-------|
| `get_my_borrows` | `WHERE userId = request.user.id` |
| `getHistory()` | `WHERE userId = request.user.id` |
| `deleteConversation()` | `WHERE id = :id AND userId = request.user.id` |
| `get_active_borrows` | Admin tool — no user scope filter |
| `get_active_reservations` | Admin tool — no user scope filter |

### Role Guard

`POST /ai/scan-cover` requires `@Roles(Role.ADMIN)` enforced by `RolesGuard`.

### Prompt Boundaries

The system prompt explicitly prohibits:
- Generating fake code to answer library questions
- Using placeholder text (e.g., `{{book_count}}`)
- Claiming lack of database access
- Executing write actions

---

## Performance

### Latency Profile

| Step | Typical Time |
|------|-------------|
| JWT verify | <1ms |
| System prompt queries (3 parallel) | 20–50ms |
| History load (50 messages) | 10–20ms |
| First Ollama response (mistral) | 800ms–1.5s |
| Tool execution — Prisma direct | 10–50ms |
| Tool execution — HTTP (books API) | 20–80ms |
| Tool execution — web fetch | 500ms–2s |
| Full answer (1 tool call) | ~2–3s to first token |

### Error Handling

**Ollama unavailable:**
```
agentService.chatStream() catches fetch error
→ yields error message to SSE stream
→ frontend displays "OZ AI is currently unavailable"
→ GET /ai/status returns { available: false }
→ frontend shows "Basic Mode" amber pill
```

**Tool execution failure:**
```
executeTool() catches error
→ returns string error message as tool result
→ model receives the error and explains it to the user
→ never throws — loop continues
```

**DB error in prompt build:**
```
buildSystemPrompt() catches Prisma error
→ falls back to minimal prompt with defaults
→ chat proceeds with reduced context
```

---

## Extending OZ AI

### Adding a New Tool

1. Add a `Tool` object to `getTools()`:

```typescript
{
  type: 'function',
  function: {
    name: 'my_new_tool',
    description: 'Clear description so the model knows when to call it.',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'What this is' },
      },
      required: ['param1'],
    },
  },
}
```

2. Add a `case` to `executeTool()`:

```typescript
case 'my_new_tool': {
  const result = await this.prisma.someTable.findMany({ ... });
  return JSON.stringify(result);
}
```

3. If the tool needs routing guidance (e.g., the model might not call it naturally), add a rule to the system prompt behaviour rules section.

4. Update `docs/ai/`.
