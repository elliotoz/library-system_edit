# OZ AI — Documentation

This directory contains comprehensive documentation for OZ AI, the agentic assistant built into the AI Integrated Library System.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Agentic loop, SSE streaming, service responsibilities, data flow |
| [Setup Guide](./SETUP_GUIDE.md) | Ollama installation, model downloads, configuration |
| [User Guide](./USER_GUIDE.md) | Role-specific capabilities, example prompts, conversation history |
| [Technical Deep-Dive](./TECHNICAL_DEEP_DIVE.md) | System prompt, tool definitions, security, performance |
| [End-to-End Diagram](./END_TO_END_DIAGRAM.md) | Complete integration flow from UI to database |

## Quick Links

### For Developers

1. Start with [Architecture](./ARCHITECTURE.md) to understand the agentic loop
2. Follow [Setup Guide](./SETUP_GUIDE.md) to configure Ollama
3. Review [Technical Deep-Dive](./TECHNICAL_DEEP_DIVE.md) for system prompt and tool details

### For Users

1. Read [User Guide](./USER_GUIDE.md) for role-specific features and example prompts

### For Documentation

1. [End-to-End Diagram](./END_TO_END_DIAGRAM.md) provides complete flow diagrams
2. Useful for graduation project reports and presentations

---

## OZ AI Overview

OZ AI is **not** a generic chatbot. It is a tool-calling agent with real-time access to the library database. Every answer about library data is backed by a live database call — no guessing, no hallucination.

### Key Features

| Feature | Description |
|---------|-------------|
| Catalog Search | Natural language book discovery via `search_catalog` tool |
| Catalog Stats | Exact live counts via `get_catalog_stats` tool |
| Book Details | Full availability, e-book link via `get_book_details` tool |
| E-Book Reading | Fetch and summarise e-book content via `read_ebook` tool |
| Web Fetch | Look up Wikipedia, papers, or any URL via `fetch_webpage` tool |
| Active Borrows | User's own borrows via `get_my_borrows`; system-wide via `get_active_borrows` |
| Reservations | System-wide reservation status via `get_active_reservations` |
| Conversation History | Persistent per-conversation message history (AiConversation model) |
| Book Cover Scan | Admin: scan cover image → auto-fill book form (gemma3:4b multimodal) |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| LLM | Ollama (local inference) |
| Models | mistral (chat), gemma3:4b (cover scan) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Next.js 14 |

### File Structure

```
apps/api/src/ai/
├── ai.module.ts              # Module definition
├── ai.controller.ts          # REST + SSE endpoints (9 total)
├── agent.service.ts          # Agentic loop — tool-calling, SSE streaming
├── ai.service.ts             # Legacy orchestrator (still registered)
├── context-builder.service.ts # DB context for legacy path
├── ollama.service.ts         # LLM integration + book cover scan
└── dto/                      # Request/response DTOs
```

### Environment Variables

```env
# Required for LLM features
OLLAMA_BASE_URL=http://localhost:11434
```

### Getting Started

```bash
# 1. Install Ollama
# Download from https://ollama.ai

# 2. Pull models
ollama pull mistral
ollama pull gemma3:4b   # optional, for cover scan

# 3. Start the application
npm run dev

# 4. Test AI status
curl http://localhost:3001/ai/status -b cookies.txt
# { "available": true, "models": ["mistral:latest", ...] }
```

### Extending OZ AI

When adding a new capability:

1. Add a new `Tool` definition to `getTools()` in `agent.service.ts`
2. Add a corresponding `case` block in `executeTool()`
3. Update the system prompt behaviour rules if the tool requires routing guidance
4. Update this documentation
