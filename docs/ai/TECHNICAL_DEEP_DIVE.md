# AI Technical Deep-Dive

## Context Building

### AiContext Interface

The complete context object built for each request:

```typescript
interface AiContext {
  // User information
  user: {
    id: string;
    name: string;
    role: Role;                    // STUDENT | INSTRUCTOR | STAFF | ADMIN
    facultyName: string | null;    // e.g., "Engineering", "Arts"
    interests: string[];           // Staff-specific personal interests
  };

  // Role-specific borrow limits
  borrowPolicy: {
    maxActiveBorrows: number;      // 5 (student), 10 (instructor), etc.
    maxBorrowDays: number;         // 14, 30, 60 days
    maxExtensions: number;         // 2, 3, unlimited
    extensionDays: number;         // 7 days per extension
  };

  // Current borrowing status
  activeBorrows: {
    count: number;                 // How many books currently borrowed
    items: Array<{
      title: string;
      dueAt: Date;
    }>;                            // Top 5 upcoming due dates
  };

  // Reservation status
  reservations: {
    count: number;                 // Total active reservations
    pending: number;               // Awaiting approval
    readyForPickup: number;        // Ready to collect
  };

  // Library catalog snapshot
  catalog: {
    totalBooks: number;            // e.g., 1500
    availableCopies: number;       // e.g., 3200
    facultyBooks: number;          // Books in user's faculty
    topCategories: string[];       // ["Computer Science", "Business", ...]
  };

  // Reading list statistics
  readingLists: {
    publishedCount: number;        // Total published lists
    followedInstructors: number;   // How many instructors user follows
    ownListCount: number;          // User's own lists (instructor/admin)
  };

  // Past borrowing history
  borrowHistory: {
    recentBooks: Array<{
      title: string;
      category: string | null;
      returnedAt: Date;
    }>;                            // Last 10 returned books
    totalBorrowed: number;         // Lifetime borrow count
  };

  // Admin-only operational data
  admin?: {
    pendingReservations: number;
    activeLoans: number;
    overdueLoans: number;
    totalUsers: number;
  };
}
```

### Database Queries

The `ContextBuilderService` executes these queries in parallel:

```typescript
await Promise.all([
  // User profile with faculty
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id, name, role, interests, faculty: { select: { name } } }
  }),

  // Borrow policy for role
  prisma.borrowPolicy.findUnique({ where: { role } }),

  // Active borrows (count + items)
  prisma.borrow.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { dueAt, bookCopy: { select: { book: { select: { title } } } } },
    orderBy: { dueAt: 'asc' },
    take: 5
  }),

  // Reservations (count + pending + ready)
  prisma.reservation.count({
    where: { userId, status: { in: ['PENDING', 'READY_FOR_PICKUP'] } }
  }),

  // Catalog stats
  prisma.book.count({ where: { isActive: true } }),
  prisma.bookCopy.count({ where: { status: 'AVAILABLE' } }),
  prisma.book.groupBy({ by: ['category'], _count: true, take: 5 }),

  // Reading list stats
  prisma.readingList.count({ where: { status: 'PUBLISHED' } }),
  prisma.instructorFollower.count({ where: { followerId: userId } }),

  // Borrow history
  prisma.borrow.findMany({
    where: { userId, status: 'RETURNED' },
    orderBy: { returnedAt: 'desc' },
    take: 10
  }),

  // [ADMIN only] System stats
  prisma.reservation.count({ where: { status: 'PENDING' } }),
  prisma.borrow.count({ where: { status: 'ACTIVE' } }),
  prisma.borrow.count({ where: { status: 'OVERDUE' } }),
  prisma.user.count({ where: { isActive: true } })
]);
```

**Total queries**: 15-19 (executed in parallel)
**Typical DB time**: ~50-100ms

---

## Prompt Templates

### Base Prompt (All Roles)

```
You are a helpful AI assistant for a university library management system.
The current user is {name}, a {Role} in the {Faculty} faculty.

Library context:
- Catalog: {totalBooks} books, {availableCopies} available copies
- Borrow policy: {maxBorrowDays} days, {maxExtensions} extensions of {extensionDays} days
- Published reading lists: {publishedCount}
- Popular categories: {topCategories}

Respond concisely and helpfully. Use markdown formatting.
Do not perform administrative actions - only provide information and guidance.
If the user asks about something outside the library system, politely redirect them.

When referencing library data, include relevant dashboard links in your response
using markdown format.

Available pages:
- Catalog: /dashboard/catalog
- Borrowed books: /dashboard/borrowed
- Reservations: /dashboard/reservations
- Reading lists: /dashboard/reading-lists
- Profile: /dashboard/profile
```

### Student Prompt Addition

```
Student-specific context:
- Active borrows: {count} / {maxActiveBorrows} ({remaining} remaining)
- Reservations: {total} total, {readyForPickup} ready for pickup, {pending} pending
- Faculty books: {facultyBooks} in {facultyName}
- Following {followedInstructors} instructor(s)
- Upcoming due dates:
  - "{title}" due {date}
  - "{title}" due {date}

Help the student find books, manage borrows, and discover reading lists.
```

### Instructor Prompt Addition

```
Instructor-specific context:
- Active borrows: {count} / {maxActiveBorrows} ({remaining} remaining)
- Own reading lists: {ownListCount}
- Faculty collection: {facultyBooks} books in {facultyName}

Help the instructor manage reading lists, find books for courses, and submit materials.
```

### Staff Prompt Addition

```
Staff-specific context:
- Active borrows: {count} / {maxActiveBorrows} ({remaining} remaining)
- User interests: {interests}

Give personalized book recommendations based on the user's interests.
```

### Admin Prompt Addition

```
Admin-specific context:
- Pending reservations: {pendingReservations}
- Active loans: {activeLoans}
- Overdue loans: {overdueLoans}
- Total users: {totalUsers}

Provide system overview and operational insights. Never execute actions - only inform.

Additional admin pages:
- Admin dashboard: /dashboard/admin
- Admin statistics: /dashboard/admin/statistics
- Admin users: /dashboard/admin/users
- Admin borrows: /dashboard/admin/borrows
- Admin reservations: /dashboard/admin/reservations
- Admin reading lists: /dashboard/admin/reading-lists
```

---

## Intent Detection Patterns

### Catalog Search Detection

```typescript
const SEARCH_TRIGGERS = [
  'find book',
  'search for',
  'look for',
  'show me book',
  'available book',
  'books about',
  'books on',
  'recommend book',
];

// Examples:
// MATCH: "Find books about machine learning"
// MATCH: "Search for psychology textbooks"
// NO MATCH: "How many books can I borrow?"
```

### Learning Path Detection

```typescript
const LEARNING_PATH_TRIGGERS = [
  'learning path',
  'study plan',
  'curriculum',
  'what should i read to learn',
  'how to learn',
  'roadmap for',
  'guide to learning',
];

// Examples:
// MATCH: "Create a learning path for data science"
// MATCH: "What should I read to learn algorithms?"
// NO MATCH: "What are learning styles?"
```

### Research Query Detection

```typescript
const RESEARCH_TRIGGERS = [
  'research on',
  'thesis about',
  'literature on',
  'academic resource',
  'scholarly',
  'publication',
  'paper on',
];

// Examples:
// MATCH: "Research on neural networks"
// MATCH: "Help with my thesis about climate change"
// NO MATCH: "What is research?"
```

### Admin Action Detection

```typescript
const ADMIN_ACTIONS = [
  'delete user',
  'deactivate user',
  'activate user',
  'approve material',
  'reject material',
  'manage user',
  'change role',
  'system setting',
  'delete book',
  'remove book',
];

// Non-admin asking: "Delete user john@test.com"
// -> Blocked with permission message
```

### Query Complexity Detection

```typescript
const DEEP_REASONING = [
  'analytics', 'compare', 'trend', 'why', 'forecast',
  'analyze', 'correlation', 'insight', 'explain why', 'what if'
];
// -> Uses llama3 model

const SIMPLE_QUERY = [
  'how do i', 'what is the policy', 'when is', 'where is',
  'how many days', 'can i borrow', 'opening hours', 'how to'
];
// -> Uses phi3 model
```

---

## Fallback Logic

### Fallback Chain

```
User Message
     |
     v
+--------------------+
| Try Ollama Chat    |
+--------------------+
     |
     +-- Success --> Return LLM response
     |
     +-- Failure (timeout, unavailable)
             |
             v
+--------------------+
| RoleResponseService|
| (Rule-based)       |
+--------------------+
     |
     v
+--------------------+
| Keyword Matching   |
| per User Role      |
+--------------------+
     |
     +-- Match Found --> Return structured response
     |
     +-- No Match --> Return generic help message
```

### Rule-Based Response Examples

**Student asking about borrowing limits:**

```typescript
if (matches(lower, ['how many', 'can i borrow', 'limit', 'remaining'])) {
  return {
    reply: `Your Borrowing Status:
- Active borrows: ${count} / ${max}
- Remaining slots: ${remaining}
- Borrow duration: ${days} days per book
- Extensions: up to ${extensions} (${extensionDays} days each)`,
    modelUsed: 'rule-based',
    sources: ['/dashboard/borrowed']
  };
}
```

**Non-admin requesting admin action:**

```typescript
if (role !== 'ADMIN' && isAdminAction(message)) {
  return {
    reply: `That action requires administrator privileges.
As a ${role.toLowerCase()}, you can:
- Browse and search the Catalog
- Manage your Borrowed Books and Reservations
- Explore Reading Lists from instructors`,
    modelUsed: 'rule-based',
    sources: ['/dashboard/catalog']
  };
}
```

---

## Security Considerations

### Authentication Layer

```
Request --> JwtAuthGuard
              |
              +-- Extract JWT from cookie
              +-- Verify signature with JWT_SECRET
              +-- Check expiration
              +-- Attach user to request
              |
              +-- PASS: Continue to controller
              +-- FAIL: 401 Unauthorized
```

### Context Isolation

- User can only see their own data
- Borrows: `WHERE userId = currentUser.id`
- Reservations: `WHERE userId = currentUser.id`
- Admin stats: Only if `role === ADMIN`

**No cross-user data leakage possible.**

### Permission Gate

Before any LLM processing:

```typescript
if (userRole !== Role.ADMIN && isAdminAction(message)) {
  // Block immediately with safe message
  // Never reaches LLM
}
```

### Prompt Boundaries

All system prompts include:

```
"Do not perform administrative actions - only provide information and guidance."
```

Role-specific boundaries:
- Student: "Help the student find books, manage borrows..."
- Admin: "Never execute actions - only inform"

### Data Exposure

| Data Type | Who Can See |
|-----------|-------------|
| Own borrows | User only |
| Own reservations | User only |
| Own interests | Staff only |
| System stats | Admin only |
| Catalog data | All users |
| Public reading lists | All users |

---

## Response Format

### ChatResponse Interface

```typescript
interface ChatResponse {
  reply: string;        // Markdown-formatted text
  modelUsed: string;    // "llama3" | "qwen2.5" | "phi3" | "rule-based" | "system"
  sources?: string[];   // ["/dashboard/catalog", "/dashboard/borrowed"]
}
```

### Example Responses

**Rule-based response (fast, no LLM):**

```json
{
  "reply": "Your Borrowing Status:\n- Active borrows: **2** / 5\n- Remaining slots: **3**\n...",
  "modelUsed": "rule-based",
  "sources": ["/dashboard/borrowed"]
}
```

**LLM response (Ollama):**

```json
{
  "reply": "Based on your interest in software engineering...\n\n1. **The Pragmatic Programmer**...",
  "modelUsed": "qwen2.5",
  "sources": ["/dashboard/catalog", "/dashboard/reading-lists"]
}
```

**System response (interest save):**

```json
{
  "reply": "Great! I've saved your interests: **finance**, **technology**...",
  "modelUsed": "system",
  "sources": ["/dashboard/catalog", "/dashboard/profile"]
}
```

---

## Performance Characteristics

### Request Latency

| Request Type | Avg Latency | Components |
|--------------|-------------|------------|
| Rule-based | ~100-200ms | JWT + DB context + keyword match |
| Catalog search | ~300-500ms | JWT + DB context + query + scoring |
| Learning path (no LLM) | ~500-800ms | JWT + DB + search + classification |
| Learning path (with LLM) | ~2-4s | Above + Ollama generate |
| General chat (phi3) | ~1-2s | JWT + DB context + LLM |
| General chat (qwen2.5) | ~2-3s | JWT + DB context + LLM |
| General chat (llama3) | ~3-5s | JWT + DB context + LLM |

### Database Load

Queries per request (context building):
- User profile: 1 query
- Borrow policy: 1 query
- Active borrows: 2 queries
- Reservations: 3 queries
- Catalog stats: 3 queries
- Reading lists: 3 queries
- Borrow history: 2 queries
- [Admin] System stats: 4 queries

**Total**: 15-19 queries (parallel)
**DB time**: ~50-100ms

---

## Error Handling

### Ollama Unavailable

```typescript
try {
  const result = await this.ollama.generate(model, message, system);
  return { reply: result.response, modelUsed: result.model, sources };
} catch (err) {
  this.logger.warn(`Ollama failed, falling back: ${err}`);
  return this.roleResponse.respond(ctx, message);
}
```

### Database Error

```typescript
// ContextBuilderService handles missing data gracefully
const policy = await prisma.borrowPolicy.findUnique({ where: { role } });
if (!policy) return DEFAULT_POLICY;
```

### Invalid User Input

```typescript
// DTOs validated by class-validator
export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
```

---

## Extensibility

### Adding New Intent

1. Create detection method in new service:
```typescript
isMyIntent(message: string): boolean {
  return TRIGGERS.some(t => message.toLowerCase().includes(t));
}
```

2. Add to AiService routing:
```typescript
if (this.myService.isMyIntent(message)) {
  return this.myService.handle(ctx, message);
}
```

3. Implement handler with response format:
```typescript
async handle(ctx: AiContext, message: string): Promise<ChatResponse> {
  // Process and return
  return { reply, modelUsed, sources };
}
```

### Adding New Model

1. Update MODEL_MAP in OllamaService:
```typescript
const MODEL_MAP: Record<Role, string> = {
  STAFF: 'phi3',
  STUDENT: 'qwen2.5',
  INSTRUCTOR: 'qwen2.5',
  ADMIN: 'llama3',
  // NEW_ROLE: 'new-model'
};
```

2. Pull model:
```bash
ollama pull new-model
```

### Adding New Role Response

1. Add method to RoleResponseService:
```typescript
private newRoleResponse(ctx: AiContext, lower: string): ChatResponse {
  // Handle queries for new role
}
```

2. Add case to switch:
```typescript
switch (ctx.user.role) {
  case Role.NEW_ROLE:
    return this.newRoleResponse(ctx, lower);
}
```
