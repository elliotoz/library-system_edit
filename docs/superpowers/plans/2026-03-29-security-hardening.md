# Security Hardening — Password Strength, Book Copy Validation, Auth Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four concrete security gaps: weak password acceptance, bypassed book-copy count enforcement, unthrottled password reset, and unauthenticated AI status disclosure.

**Architecture:** All four changes are additive decorator/annotation fixes on existing files. No schema migrations, no new files, no service logic changes. The global `ValidationPipe` with `whitelist: true` is already enabled — changes to DTOs take effect immediately.

**Tech Stack:** NestJS `class-validator` + `class-transformer`, `@nestjs/throttler`, NestJS `JwtAuthGuard`

---

## File Map

**Modify:**
- `apps/api/src/auth/dto/auth.dto.ts` — add `@Matches` + `@MinLength(8)` to `RegisterDto.password` and `ResetPasswordDto.password`
- `apps/api/src/books/dto/books.dto.ts` — add `@ValidateNested({ each: true })` + `@Type(() => BranchCopiesDto)` to `CreateBookDto.branches`
- `apps/api/src/auth/auth.controller.ts` — add `@UseGuards(ThrottlerGuard)` + `@Throttle()` to `resetPassword` handler (line 154–162)
- `apps/api/src/ai/ai.controller.ts` — add `@UseGuards(JwtAuthGuard)` to `getStatus()` handler (line 27–31)
- `CURRENT_STATE.md`
- `.ai/ACTIVITY_LOG.md`

---

### Task 1: Password strength validation in RegisterDto and ResetPasswordDto

**Files:**
- Modify: `apps/api/src/auth/dto/auth.dto.ts:55-116`

Context: `RegisterDto.password` and `ResetPasswordDto.password` both accept `MinLength(6)` only. The password `aaaaaa` passes. We add `@MinLength(8)` and a `@Matches` pattern requiring at least one uppercase letter, one lowercase letter, and one digit. `LoginDto` is intentionally excluded — password validation on login must be permissive (you check the hash, not the format).

- [ ] **Step 1: Update auth.dto.ts**

Add `Matches` to the import line at the top of the file:
```typescript
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, Matches } from 'class-validator';
```

Replace the `password` field in `RegisterDto` (lines 67–71):
```typescript
  @ApiProperty({ example: 'Password1', description: 'Password (min 8 chars, must contain uppercase, lowercase, and digit)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;
```

Replace the `password` field in `ResetPasswordDto` (lines 111–115):
```typescript
  @ApiProperty({ example: 'NewPassword1', description: 'New password (min 8 chars, must contain uppercase, lowercase, and digit)' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors

- [ ] **Step 3: Run critical tests**

```bash
npm run test:api:critical
```
Expected: 24 pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/dto/auth.dto.ts
git commit -m "fix(auth): require password strength — min 8 chars, upper+lower+digit in RegisterDto and ResetPasswordDto"
```

---

### Task 2: Fix CreateBookDto.branches nested validation bypass

**Files:**
- Modify: `apps/api/src/books/dto/books.dto.ts:151-153`

Context: `CreateBookDto.branches` is typed as `BranchCopiesDto[]` with `@IsArray()` only. The global `ValidationPipe` does **not** recurse into array elements unless you explicitly add `@ValidateNested({ each: true })` and `@Type(() => BranchCopiesDto)`. Without these, the `@Max(50)` on `BranchCopiesDto.numberOfCopies` is never evaluated — an admin could submit `numberOfCopies: 99999` and it would be accepted.

- [ ] **Step 1: Update books.dto.ts**

Replace the import line at the top of `books.dto.ts`:
```typescript
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsBoolean,
  ValidateNested,
} from "class-validator";
```

Replace the `branches` field in `CreateBookDto` (lines 151–153):
```typescript
  @ApiProperty({ type: [BranchCopiesDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchCopiesDto)
  branches: BranchCopiesDto[];
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors

- [ ] **Step 3: Run critical tests**

```bash
npm run test:api:critical
```
Expected: 24 pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/books/dto/books.dto.ts
git commit -m "fix(books): add ValidateNested+Type to CreateBookDto.branches so BranchCopiesDto Max(50) is enforced"
```

---

### Task 3: Rate-limit the reset-password endpoint

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts:154-162`

Context: `POST /auth/forgot-password` is rate-limited at line 145 (`@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { ttl: 60000, limit: 5 } })`). `POST /auth/reset-password` at line 154 is the same risk surface — an attacker can brute-force 6-digit reset tokens without throttling. Apply identical rate-limiting.

- [ ] **Step 1: Update auth.controller.ts**

Find the `resetPassword` handler (lines 154–162). Replace it with:
```typescript
  @Public()
  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
```

No new imports needed — `ThrottlerGuard` and `Throttle` are already imported at the top of this file (used by `forgotPassword` at line 145).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors

- [ ] **Step 3: Run critical tests**

```bash
npm run test:api:critical
```
Expected: 24 pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts
git commit -m "fix(auth): rate-limit POST /auth/reset-password to 5 req/60s to prevent token brute-force"
```

---

### Task 4: Guard GET /ai/status behind JwtAuthGuard

**Files:**
- Modify: `apps/api/src/ai/ai.controller.ts:27-31`

Context: `GET /ai/status` at line 27 has no `@UseGuards(JwtAuthGuard)`. The `AiController` class has no class-level guard. All other `AiController` endpoints (`/conversations`, `/agent/chat`, `/scan-cover`, etc.) individually apply `@UseGuards(JwtAuthGuard)`. This endpoint was missed. It discloses whether Ollama is running and which models are loaded — useful for reconnaissance.

- [ ] **Step 1: Update ai.controller.ts**

Replace the `getStatus()` handler (lines 27–31):
```typescript
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Ollama availability and model list' })
  async getStatus() {
    return this.agentService.getStatus();
  }
```

`JwtAuthGuard` and `ApiBearerAuth` are already imported at lines 4 and 3 respectively.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors

- [ ] **Step 3: Run critical tests**

```bash
npm run test:api:critical
```
Expected: 24 pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/ai.controller.ts
git commit -m "fix(ai): require authentication on GET /ai/status to prevent unauthenticated Ollama reconnaissance"
```

---

### Task 5: Verification + CURRENT_STATE update

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `.ai/ACTIVITY_LOG.md`

- [ ] **Step 1: Full verification**

```bash
npm run typecheck:api
npm run test:api:critical
npm run typecheck:web
```
Expected: typecheck:api clean, 24 critical tests pass, typecheck:web clean.

No `build:web` needed — all changes are backend-only and the frontend makes no new calls.
No e2e needed — no schema or service logic was changed.

- [ ] **Step 2: Update CURRENT_STATE.md**

In `## Last Completed`, add:
```
* Security hardening: `RegisterDto` and `ResetPasswordDto` now require min 8-char passwords with at least one uppercase, lowercase, and digit via `@Matches`. `POST /auth/reset-password` is rate-limited to 5 req/60s (matches `forgot-password`). `CreateBookDto.branches` adds `@ValidateNested({ each: true })` + `@Type(() => BranchCopiesDto)` so the `@Max(50)` on `numberOfCopies` is actually enforced. `GET /ai/status` is now guarded by `JwtAuthGuard`. References: [auth.dto.ts](/C:/Projects/library-system_edit/apps/api/src/auth/dto/auth.dto.ts), [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts), [books.dto.ts](/C:/Projects/library-system_edit/apps/api/src/books/dto/books.dto.ts), [ai.controller.ts](/C:/Projects/library-system_edit/apps/api/src/ai/ai.controller.ts)
```

Score remains 10/10. No issues remain at any priority level.

- [ ] **Step 3: Update .ai/ACTIVITY_LOG.md**

Append:
```markdown
## 2026-03-29 - Security Hardening (Password Strength, Book Copy Validation, Auth Rate Limiting, AI Status Guard)

### What changed
- `apps/api/src/auth/dto/auth.dto.ts` — RegisterDto + ResetPasswordDto now require `@MinLength(8)` and `@Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)` on password field
- `apps/api/src/books/dto/books.dto.ts` — CreateBookDto.branches adds `@ValidateNested({ each: true })` + `@Type(() => BranchCopiesDto)` to enforce nested BranchCopiesDto constraints
- `apps/api/src/auth/auth.controller.ts` — POST /auth/reset-password gets `@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { ttl: 60000, limit: 5 } })`
- `apps/api/src/ai/ai.controller.ts` — GET /ai/status gets `@UseGuards(JwtAuthGuard)`

### Verification
- `npm run typecheck:api` — PASS
- `npm run test:api:critical` — PASS (24 tests)
- `npm run typecheck:web` — PASS
```

- [ ] **Step 4: Commit**

```bash
git add CURRENT_STATE.md .ai/ACTIVITY_LOG.md
git commit -m "docs(state): reflect security hardening complete"
```
