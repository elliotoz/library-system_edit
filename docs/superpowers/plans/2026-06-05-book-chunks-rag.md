# Catalog Book Chunks RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RAG-style indexed chunks for catalog books so OZ AI can retrieve and teach from book content with quality similar to academic materials.

**Architecture:** Catalog books will keep their existing metadata and readable document fields, then gain a separate `BookChunk` table for full-text retrieval. Book content indexing, search services, AI tools, and prompt routing are added in later phases after the database foundation is in place.

**Tech Stack:** NestJS, Prisma, PostgreSQL full-text search, OpenRouter tool-calling agent, existing document extraction services.

---

## Phase Checklist

- [x] **Phase 1: Database support for book chunks**
  - [x] Add `Book.chunks` relation.
  - [x] Add `BookChunk` Prisma model.
  - [x] Create `add_book_chunks` migration.
  - [x] Add PostgreSQL GIN full-text index on `book_chunks.content`.
  - [x] Keep all existing book fields unchanged.
- [x] **Phase 2: Book indexing behavior**
  - [x] Extend `BookDocumentService` to create `BookChunk` rows after extraction.
  - [x] Store `pdfExtractedText` for backward compatibility.
  - [x] Delete old chunks before re-indexing a book.
  - [x] Keep `pdfIndexStatus`, `pdfIndexedAt`, and `pdfPageCount` accurate.
  - [x] Support `pdfUrl` and PDF-like `ebookUrl` sources.
- [ ] **Phase 3: Book content search service**
  - [ ] Create `BookContentSearchService`.
  - [ ] Add `searchBookChunks(query, bookId?, limit?)`.
  - [ ] Add `getBookChunkNeighbors(bookId, chunkIndex)`.
  - [ ] Add `getBookOutline(bookId)`.
  - [ ] Add focused service tests.
- [ ] **Phase 4: Admin backfill and indexing controls**
  - [ ] Add bounded admin endpoint for readable book indexing.
  - [ ] Include books with `pdfUrl` or PDF-like `ebookUrl`.
  - [ ] Avoid blocking request completion on long indexing work.
  - [ ] Add tests for queuing behavior.
- [ ] **Phase 5: OZ AI book-content tools**
  - [ ] Add `search_book_content`.
  - [ ] Add `get_book_chunk_context`.
  - [ ] Add `get_book_outline`.
  - [ ] Keep material tools scoped to uploaded academic materials.
  - [ ] Add `AgentService` tests for tool definitions and execution.
- [ ] **Phase 6: Prompt routing and study behavior**
  - [ ] Update system prompt rules for indexed catalog books.
  - [ ] Use catalog tools before book-content tools.
  - [ ] Prefer book chunks for teaching/summarizing/explaining indexed books.
  - [ ] Use `read_ebook` only as fallback or for full-document structure extraction.
  - [ ] Add prompt tests.
- [ ] **Phase 7: Documentation and final verification**
  - [ ] Update README AI/tool/database sections.
  - [ ] Run Prisma, typecheck, build, and targeted Jest tests.
  - [ ] Manually verify Pro Git indexing and retrieval once Phase 2+ is implemented.

## Phase 1 Scope

Phase 1 is intentionally database-only. It must not change runtime behavior, indexing behavior, AI tools, prompt routing, frontend UI, or study-session behavior.

### Files

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_book_chunks/migration.sql`

### Acceptance Criteria

- `Book` has a `chunks BookChunk[]` relation.
- `BookChunk.content` uses `String @db.Text`.
- The migration creates `book_chunks`.
- The migration creates a unique `(bookId, chunkIndex)` constraint.
- The migration creates an index on `bookId`.
- The migration creates `book_chunks_content_gin` using `to_tsvector('simple', content)`.
- Existing fields `pdfExtractedText`, `pdfUrl`, `ebookUrl`, `pdfIndexStatus`, `pdfIndexedAt`, and `pdfPageCount` remain unchanged.

## Later Phase Notes

Book chunks should use larger windows than academic materials because books are longer and teaching often needs more narrative context. The recommended later constants are:

```ts
const BOOK_CHUNK_WORDS = 700;
const BOOK_CHUNK_OVERLAP_WORDS = 80;
```

Remote HTML e-books should not be indexed in the first behavior phase. Start with uploaded/local PDFs and remote URLs that clearly end in `.pdf`; keep `read_ebook` as fallback for HTML or unknown e-book URLs.

## Verification Commands

After Phase 1 implementation:

```bash
cd apps/api
npx prisma migrate dev --name add_book_chunks
npx prisma generate
```

From repo root:

```bash
npm run typecheck:api
npm run build --workspace=apps/api
```
