# External E-Book Integration

## Overview

The Library Management System integrates with two free, open-access book APIs to enrich the catalog with digital content without manual data entry. This document describes the motivation, architecture, integration workflow, and storage strategy for external e-book imports.

---

## Why External APIs?

University libraries face a growing demand for digital resources. Manually cataloguing thousands of e-books is time-consuming and error-prone. By integrating with well-established open-access repositories, administrators can:

- Discover and import books from public-domain collections in seconds
- Ensure e-book metadata (title, authors, cover, description) is accurate and sourced from authoritative databases
- Distinguish imported titles from manually entered physical stock
- Expand the digital catalog without licensing or procurement costs

---

## Integrated APIs

### Open Library (openlibrary.org)

Open Library is an open, editable library catalogue maintained by the Internet Archive. It contains metadata for millions of books, many with freely accessible digital editions.

- **Endpoint used:** `https://openlibrary.org/search.json`
- **Authentication:** None required
- **Rate limit:** No enforced limit for reasonable use
- **Cover images:** Retrieved from `https://covers.openlibrary.org/b/id/{cover_id}-M.jpg`
- **E-book link:** Points to the Open Library works page (`/works/{key}`)

### Gutendex (gutendex.com)

Gutendex is a JSON web API for Project Gutenberg, the largest collection of free public-domain e-books. It provides structured access to over 70,000 titles with full-text download links.

- **Endpoint used:** `https://gutendex.com/books/`
- **Authentication:** None required
- **Rate limit:** None
- **Cover images:** Retrieved from `formats['image/jpeg']`
- **E-book link:** Retrieved from `formats['text/html']` or `formats['application/epub+zip']`

---

## Architecture

```
Admin Browser
     │
     ▼
Next.js Admin Page (/dashboard/admin/import-books)
     │  GET /api/external-books/search?q=
     │  POST /api/external-books/import
     ▼
Next.js Proxy (/api/* → localhost:3001/*)
     │
     ▼
NestJS ExternalBooksModule
  ├── ExternalBooksController  (route handlers, auth guards)
  └── ExternalBooksService
        ├── fetchOpenLibraryBooks()   → openlibrary.org
        ├── fetchGutendexBooks()      → gutendex.com
        ├── normalizeGutendexResults()
        ├── importBook()              → Prisma Book.create()
        └── bulkImportGutendex()      → Prisma bulk insert
     │
     ▼
PostgreSQL (books table)
```

### Module location

```
apps/api/src/external-books/
├── dto/
│   └── external-books.dto.ts   (ImportBookDto, NormalizedBook interface)
├── external-books.controller.ts
├── external-books.service.ts
└── external-books.module.ts
```

---

## API Integration Workflow

### Search

1. Administrator enters a search query in the admin UI
2. The frontend calls `GET /external-books/search?q=<query>`
3. The backend sends concurrent requests to Open Library and Gutendex using `Promise.allSettled` — if one source fails, the other still returns results
4. Each source's response is normalised into a common `NormalizedBook` shape
5. The combined list is returned to the frontend and rendered as a book card grid

### Single Import

1. Administrator clicks **Import** on a search result card
2. The frontend calls `POST /external-books/import` with the normalised book payload
3. The service checks for a duplicate ISBN before inserting
4. A new `Book` record is created with `isEbookAvailable: true` and `source` set to the originating API name (`"OpenLibrary"` or `"Gutendex"`)

### Bulk Import (Gutendex)

1. Administrator clicks **Bulk Import Gutendex**
2. The backend fetches pages 1–4 from the Gutendex catalogue concurrently (up to ~128 books)
3. Each book is individually inserted; duplicates are skipped silently
4. The response reports how many were imported and how many were skipped

---

## Data Normalisation

All external sources are normalised to the following structure before storage:

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Book title |
| `authors` | `string[]` | List of author names |
| `description` | `string?` | Short synopsis or abstract |
| `coverImageUrl` | `string?` | URL to cover image |
| `ebookUrl` | `string?` | URL to read or download the e-book |
| `source` | `string` | `"OpenLibrary"` or `"Gutendex"` |
| `isbn` | `string?` | ISBN-10 or ISBN-13 (if available) |
| `publicationYear` | `number?` | Year of first publication |

---

## Database Storage

External books are stored in the same `books` table as manually entered titles. Key field values set during import:

| Field | Value |
|---|---|
| `isEbookAvailable` | `true` |
| `source` | API name (e.g. `"Gutendex"`) |
| `ebookUrl` | Direct link to the e-book |
| `coverImageUrl` | Cover image URL from the source API |

This unified storage model means imported e-books appear in all existing catalog queries, search results, and reading lists without any additional configuration.

---

## Distinguishing Imported from Manual Entries

The `source` field on the `Book` model differentiates origin:

| Source value | Origin |
|---|---|
| `"Manual"` | Entered by an administrator through the standard book form |
| `"OpenLibrary"` | Imported from Open Library |
| `"Gutendex"` | Imported from Project Gutenberg via Gutendex |

---

## Security

- `GET /external-books/search` — requires a valid JWT (any authenticated role)
- `POST /external-books/import` — requires ADMIN role (`RolesGuard` + `@Roles(Role.ADMIN)`)
- `POST /external-books/import/gutendex` — requires ADMIN role
- The admin UI page is protected by the existing `AuthGuard` component and Next.js middleware, both enforcing the `ADMIN` role

---

## Future Integration Possibilities

The normalised book data stored in PostgreSQL is well-positioned for downstream AI-powered features:

- **Personalised recommendations:** The `source`, `subjectTags`, and `ebookUrl` fields can be used as input features for a collaborative or content-based recommendation engine, suggesting e-books to students based on their borrowing history and interests
- **Semantic search:** Embedding book descriptions and subject tags into a vector store would allow natural-language queries ("find introductory biology textbooks") to surface relevant imported titles alongside physical stock
- **Reading list suggestions:** When an instructor creates a reading list for a course, the system could surface relevant Gutendex or Open Library titles as candidates based on the course subject
- **Usage analytics:** Tracking which imported e-books are accessed most frequently can inform future bulk import strategies and collection development priorities

These capabilities are feasible without changes to the current data model, as all required fields are already populated during the import process.
