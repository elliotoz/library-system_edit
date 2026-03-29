# DTO Validation + Frontend Error Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two Low Priority Improvements in CURRENT_STATE.md: (1) backend endpoints that bypass ValidationPipe via primitive `@Body()` extraction or raw query-string `parseInt()`, and (2) frontend error handlers that display raw array messages inconsistently.

**Architecture:** Add `UpdateInterestsDto` for the body gap; expand `BorrowQueryDto` and add typed query DTOs with `@Type(() => Number)` coercion and `@Max` caps for borrow endpoints; add service-side clamping where missing; create `extractApiError` (fetch) and `extractAxiosError` (axios) helpers and apply to all affected pages.

**Tech Stack:** NestJS `class-validator` + `class-transformer` + `@prisma/client` enums, Next.js 14 fetch + axios API client, TypeScript

---

## File Map

**Create:**
- `apps/api/src/users/dto/update-interests.dto.ts`
- `apps/web/lib/api-error.ts`

**Modify:**
- `apps/api/src/borrows/dto/borrows.dto.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/borrows/borrows.controller.ts`
- `apps/api/src/borrows/borrows.service.ts` (clamp `findMyHistory` + `findAllHistory`)
- `apps/web/app/dashboard/admin/reservations/page.tsx` (3 locations)
- `apps/web/app/dashboard/admin/borrows/page.tsx` (1 location)
- `apps/web/app/dashboard/borrowed/page.tsx` (1 location)
- `apps/web/app/dashboard/reservations/page.tsx` (1 location)
- `apps/web/app/dashboard/profile/page.tsx` (1 location)
- `apps/web/app/dashboard/catalog/[id]/page.tsx` (1 location)
- `apps/web/app/dashboard/instructor/submit-material/page.tsx` (1 location)
- `apps/web/app/dashboard/admin/upload/page.tsx` (1 location)
- `apps/web/app/dashboard/admin/books/new/page.tsx` (1 location)
- `apps/web/app/dashboard/admin/books/[id]/edit/page.tsx` (2 locations)
- `apps/web/app/dashboard/admin/policies/page.tsx` (1 location — axios path)

**Update:**
- `CURRENT_STATE.md`
- `ACTIVITY_LOG.md`

---

### Task 1: Add UpdateInterestsDto and wire it into UsersController

**Files:**
- Create: `apps/api/src/users/dto/update-interests.dto.ts`
- Modify: `apps/api/src/users/users.controller.ts:136-144`

- [ ] **Step 1: Create the DTO**

`apps/api/src/users/dto/update-interests.dto.ts`:
```typescript
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInterestsDto {
  @ApiProperty({ type: [String], description: 'List of interest keywords' })
  @IsArray()
  @IsString({ each: true })
  interests: string[];
}
```

- [ ] **Step 2: Update users.controller.ts**

Add to the import block:
```typescript
import { UpdateInterestsDto } from './dto/update-interests.dto';
```

Replace the `updateMyInterests` handler:
```typescript
  @Patch('interests')
  @ApiOperation({ summary: 'Update current user interests' })
  @ApiResponse({ status: 200, description: 'Interests updated' })
  async updateMyInterests(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.usersService.updateInterests(userId, dto.interests);
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: test:critical**

```bash
cd apps/api && npm run test:critical
```
Expected: 24 pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/users/dto/update-interests.dto.ts apps/api/src/users/users.controller.ts
git commit -m "fix(users): add UpdateInterestsDto to validate interests array input"
```

---

### Task 2: Expand borrow DTOs and update BorrowsController

**Files:**
- Modify: `apps/api/src/borrows/dto/borrows.dto.ts`
- Modify: `apps/api/src/borrows/borrows.controller.ts`

- [ ] **Step 1: Replace full borrows.dto.ts**

```typescript
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsEnum,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BorrowStatus, Role } from '@prisma/client';

export class CreateBorrowDto {
  @ApiProperty()
  @IsString()
  bookCopyId: string;

  @ApiProperty()
  @IsString()
  userId: string;
}

export class ExtendBorrowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  newDueDate?: string;
}

export class BorrowQueryDto {
  @ApiPropertyOptional({ enum: BorrowStatus })
  @IsOptional()
  @IsEnum(BorrowStatus)
  status?: BorrowStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// BorrowHistoryQueryDto: status and role accept 'all' (service filters on !== 'all')
export class BorrowHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookId?: string;

  @ApiPropertyOptional({ description: "Role name or 'all'" })
  @IsOptional()
  @IsIn(['all', ...Object.values(Role)])
  role?: string;

  @ApiPropertyOptional({ description: "BorrowStatus or 'all'" })
  @IsOptional()
  @IsIn(['all', ...Object.values(BorrowStatus)])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class MostBorrowedQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class TrendsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
```

- [ ] **Step 2: Update borrows.controller.ts**

Add to the import block:
```typescript
import {
  BorrowQueryDto,
  BorrowHistoryQueryDto,
  MostBorrowedQueryDto,
  TrendsQueryDto,
} from './dto/borrows.dto';
```

Replace five handlers (keep all other handlers unchanged):

```typescript
  @Get('history')
  @ApiOperation({ summary: 'Get my borrow history' })
  async getMyHistory(
    @CurrentUser('id') userId: string,
    @Query() dto: BorrowHistoryQueryDto,
  ) {
    return this.borrowsService.findMyHistory(userId, {
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }

  @Get('admin/history')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all borrow history (admin)' })
  async getAllHistory(@Query() dto: BorrowHistoryQueryDto) {
    return this.borrowsService.findAllHistory({
      page: dto.page,
      pageSize: dto.pageSize,
      userId: dto.userId,
      bookId: dto.bookId,
      role: dto.role,
      status: dto.status,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
  }

  @Get('admin/most-borrowed')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get most borrowed books' })
  async getMostBorrowed(@Query() dto: MostBorrowedQueryDto) {
    return this.borrowsService.getMostBorrowedBooks(dto.limit ?? 10);
  }

  @Get('admin/trends')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get borrow trends' })
  async getTrends(@Query() dto: TrendsQueryDto) {
    return this.borrowsService.getBorrowTrends(dto.months ?? 6);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all borrows (admin only)' })
  async getAllBorrows(@Query() dto: BorrowQueryDto) {
    return this.borrowsService.findAllBorrows({
      status: dto.status,
      userId: dto.userId,
      page: dto.page,
      pageSize: dto.pageSize,
    });
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: test:critical**

```bash
cd apps/api && npm run test:critical
```
Expected: 24 pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/borrows/dto/borrows.dto.ts apps/api/src/borrows/borrows.controller.ts
git commit -m "fix(borrows): replace raw query parseInt with typed DTOs and add Max caps"
```

---

### Task 3: Add service-side clamping to findMyHistory and findAllHistory

**Files:**
- Modify: `apps/api/src/borrows/borrows.service.ts`

Context: `findAllBorrows` already clamps with `Math.min(query.pageSize || 20, 100)` at line 163. `findMyHistory` and `findAllHistory` do not clamp — they must, as a defence-in-depth layer separate from DTO `@Max`.

- [ ] **Step 1: Clamp findMyHistory**

In `findMyHistory` (around line 371), change:
```typescript
const pageSize = Number(query.pageSize) || 10;
```
to:
```typescript
const pageSize = Math.min(Number(query.pageSize) || 10, 100);
```

- [ ] **Step 2: Clamp findAllHistory**

In `findAllHistory` (around line 436), change:
```typescript
const pageSize = Number(query.pageSize) || 20;
```
to:
```typescript
const pageSize = Math.min(Number(query.pageSize) || 20, 100);
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: test:critical**

```bash
cd apps/api && npm run test:critical
```
Expected: 24 pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/borrows/borrows.service.ts
git commit -m "fix(borrows): clamp pageSize in findMyHistory and findAllHistory to 100"
```

---

### Task 4: Add extractApiError and extractAxiosError helpers

**Files:**
- Create: `apps/web/lib/api-error.ts`

Note: Most pages use raw `fetch` returning a `Response`. The policies page uses the `borrowPoliciesApi` axios wrapper, where errors surface as `error.response.data.message`. Both helpers go in the same file.

- [ ] **Step 1: Create the helper file**

`apps/web/lib/api-error.ts`:
```typescript
/**
 * Extracts a human-readable error message from a non-ok fetch Response.
 *
 * Backend contract (GlobalExceptionFilter):
 *   { success: false, message: string | string[], requestId: string, timestamp: string }
 *
 * If message is string[], returns the first element.
 * If body cannot be parsed, returns fallback.
 */
export async function extractApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    const msg = body?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === 'string') return msg;
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Extracts a human-readable error message from an axios error.
 * Axios surfaces backend JSON as error.response.data.
 */
export function extractAxiosError(error: unknown, fallback: string): string {
  const data = (error as any)?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

---

### Task 5: Apply helpers to all affected frontend pages

**Files:** 11 pages (see file map above)

Import line to add to each fetch-based page:
```typescript
import { extractApiError } from '@/lib/api-error';
```

Import line to add to policies page:
```typescript
import { extractAxiosError } from '@/lib/api-error';
```

**Pattern A — raw fetch, no array handling (most pages):**
```typescript
// Before
const error = await response.json();
toast.error(error.message || 'Failed to do X');

// After
toast.error(await extractApiError(response, 'Failed to do X'));
```

**Pattern B — raw fetch with `.catch(() => null)` (admin/reservations):**
```typescript
// Before
const error = await response.json().catch(() => null);
toast.error(error?.message || 'Failed to do X');

// After
toast.error(await extractApiError(response, 'Failed to do X'));
```

**Pattern C — profile page (already handles arrays inline):**
```typescript
// Before
const err = await response.json().catch(() => null);
const msg = err?.message;
toast.error(Array.isArray(msg) ? msg[0] : msg || 'Failed to update profile');

// After
toast.error(await extractApiError(response, 'Failed to update profile'));
```

**Pattern D — axios client (policies page):**
```typescript
// Before
} catch (error: any) {
  const msg = error?.response?.data?.message || 'Failed to update policy';
  toast.error(Array.isArray(msg) ? msg[0] : msg);
}

// After
} catch (error) {
  toast.error(extractAxiosError(error, 'Failed to update policy'));
}
```

- [ ] **Step 1: admin/reservations/page.tsx — 3 locations (reject ~L110, mark-ready ~L131, collect ~L161)**

Apply Pattern B to all three.

- [ ] **Step 2: admin/borrows/page.tsx — 1 location (return book ~L118)**

Apply Pattern A.

- [ ] **Step 3: borrowed/page.tsx — 1 location (extend ~L119)**

Apply Pattern A.

- [ ] **Step 4: reservations/page.tsx — 1 location (cancel ~L118)**

Apply Pattern A.

- [ ] **Step 5: profile/page.tsx — 1 location (~L171)**

Apply Pattern C.

- [ ] **Step 6: catalog/[id]/page.tsx — 1 location (create reservation ~L184)**

Apply Pattern A.

- [ ] **Step 7: instructor/submit-material/page.tsx — 1 location (~L161)**

Apply Pattern A.

- [ ] **Step 8: admin/upload/page.tsx — 1 location (~L170)**

Apply Pattern A.

- [ ] **Step 9: admin/books/new/page.tsx — 1 location (~L269)**

Apply Pattern A.

- [ ] **Step 10: admin/books/[id]/edit/page.tsx — 2 locations (~L216, ~L250)**

Apply Pattern A to both.

- [ ] **Step 11: admin/policies/page.tsx — 1 location (~L64)**

Apply Pattern D (axios path).

- [ ] **Step 12: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 13: Completion grep check**

Run these searches and confirm zero matches remain:
```bash
grep -rn "toast.error(error.message" apps/web/app/dashboard
grep -rn "const error = await response.json();" apps/web/app/dashboard
grep -rn "Array.isArray(msg) ? msg\[0\] : msg" apps/web/app/dashboard
```
Expected: all three return no output

- [ ] **Step 14: Commit**

```bash
git add apps/web/lib/api-error.ts \
  apps/web/app/dashboard/admin/reservations/page.tsx \
  apps/web/app/dashboard/admin/borrows/page.tsx \
  apps/web/app/dashboard/borrowed/page.tsx \
  apps/web/app/dashboard/reservations/page.tsx \
  apps/web/app/dashboard/profile/page.tsx \
  "apps/web/app/dashboard/catalog/[id]/page.tsx" \
  apps/web/app/dashboard/instructor/submit-material/page.tsx \
  apps/web/app/dashboard/admin/upload/page.tsx \
  apps/web/app/dashboard/admin/books/new/page.tsx \
  "apps/web/app/dashboard/admin/books/[id]/edit/page.tsx" \
  apps/web/app/dashboard/admin/policies/page.tsx
git commit -m "fix(web): normalize frontend error messages via extractApiError/extractAxiosError helpers"
```

---

### Task 6: Full verification, CURRENT_STATE and ACTIVITY_LOG updates

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `ACTIVITY_LOG.md`

- [ ] **Step 1: Run full verification suite**

```bash
cd /path/to/repo
npm run typecheck:api
npm run test:api:critical
npm run db:start
npm run test:api:e2e
npm run db:stop
npm run typecheck:web
npm run build:web
```
Expected: all pass (build:web emits no errors; warnings from jose JWE are pre-existing and acceptable)

- [ ] **Step 2: Update CURRENT_STATE.md**

In `## Last Completed`, add:
```
* DTO validation gaps closed. `PATCH /users/interests` validates via `UpdateInterestsDto` (`@IsArray`, `@IsString({ each: true })`). Borrow query endpoints use `BorrowQueryDto`, `BorrowHistoryQueryDto`, `MostBorrowedQueryDto`, and `TrendsQueryDto` with `@Type(() => Number)` coercion and `@Max` caps; service-side clamping added to `findMyHistory` and `findAllHistory`. Frontend error handlers consolidated via `extractApiError` (fetch) and `extractAxiosError` (axios) helpers that normalize `string | string[]` backend messages. References: [update-interests.dto.ts](/C:/Projects/library-system_edit/apps/api/src/users/dto/update-interests.dto.ts), [borrows.dto.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/dto/borrows.dto.ts), [api-error.ts](/C:/Projects/library-system_edit/apps/web/lib/api-error.ts)
```

Remove both entries from `## Low Priority Improvements`. Update score reasoning if applicable.

- [ ] **Step 3: Update ACTIVITY_LOG.md**

Append a new entry:
```markdown
## 2026-03-29 — DTO Validation + Frontend Error Normalization

### What changed
- Created `apps/api/src/users/dto/update-interests.dto.ts` — closes primitive `@Body('interests')` extraction
- Expanded `apps/api/src/borrows/dto/borrows.dto.ts` — typed query DTOs with `@Type(() => Number)`, `@IsEnum(BorrowStatus)`, and `@Max` caps
- Updated `apps/api/src/borrows/borrows.service.ts` — added `Math.min(..., 100)` clamping to `findMyHistory` and `findAllHistory`
- Created `apps/web/lib/api-error.ts` — `extractApiError` (fetch) and `extractAxiosError` (axios) helpers
- Updated 11 frontend pages to use the helpers

### Verification
- `npm run typecheck:api` — PASS
- `npm run test:api:critical` — PASS (24 tests)
- `npm run test:api:e2e` — PASS (28 tests)
- `npm run typecheck:web` — PASS
- `npm run build:web` — PASS
```

- [ ] **Step 4: Commit**

```bash
git add CURRENT_STATE.md ACTIVITY_LOG.md
git commit -m "docs(state): reflect DTO validation and frontend error normalization complete"
```
