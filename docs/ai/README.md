# AI Integration Documentation

This directory contains comprehensive documentation for the AI integration in the Smart Library Management System.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, service responsibilities, data flow diagrams |
| [Setup Guide](./SETUP_GUIDE.md) | Ollama installation, model downloads, configuration |
| [User Guide](./USER_GUIDE.md) | Role-specific capabilities, example prompts, tips |
| [Technical Deep-Dive](./TECHNICAL_DEEP_DIVE.md) | Context building, prompt templates, security |
| [End-to-End Diagram](./END_TO_END_DIAGRAM.md) | Complete integration flow from UI to database |

## Quick Links

### For Developers

1. Start with [Architecture](./ARCHITECTURE.md) to understand the system
2. Follow [Setup Guide](./SETUP_GUIDE.md) to configure Ollama
3. Review [Technical Deep-Dive](./TECHNICAL_DEEP_DIVE.md) for implementation details

### For Users

1. Read [User Guide](./USER_GUIDE.md) for your role-specific features
2. Check example prompts for each capability

### For Documentation

1. [End-to-End Diagram](./END_TO_END_DIAGRAM.md) provides visual flow diagrams
2. Useful for graduation project reports and presentations

## AI Module Overview

The AI module transforms a traditional library system into a **Smart Library Management System** by providing:

- **Natural Language Interaction** - Ask questions in plain English
- **Role-Aware Responses** - Different capabilities per user role
- **Live Context** - Responses based on real-time library data
- **Graceful Degradation** - Works even when LLM is unavailable

## Key Features

| Feature | Description |
|---------|-------------|
| Catalog Search | Natural language book discovery |
| Learning Paths | Structured study plans from catalog |
| Research Assistant | Literature guidance and resources |
| Role-Specific Chat | Personalized help per user type |
| Interest-Based Recommendations | Staff personalization |
| Admin Insights | Operational analytics |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| LLM | Ollama (local inference) |
| Models | phi3, qwen2.5, llama3 |
| Frontend | Next.js 14 |

## File Structure

```
apps/api/src/ai/
├── ai.module.ts              # Module definition
├── ai.controller.ts          # REST endpoints
├── ai.service.ts             # Orchestrator
├── context-builder.service.ts # DB context
├── role-response.service.ts  # Rule-based fallback
├── catalog-search.service.ts # NL search
├── semantic-search.service.ts # Scoring
├── learning-path.service.ts  # Learning paths
├── research-assistant.service.ts # Research help
├── ollama.service.ts         # LLM integration
└── dto/                      # Request DTOs
```

## Environment Variables

```env
# Required for LLM features
OLLAMA_BASE_URL=http://localhost:11434
```

## Getting Started

```bash
# 1. Install Ollama
# Download from https://ollama.ai

# 2. Pull models
ollama pull phi3 qwen2.5 llama3

# 3. Start the application
npm run dev

# 4. Test AI endpoint
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message": "How many books can I borrow?"}'
```

## Contributing

When extending the AI module:

1. Add new intent detection in `AiService`
2. Create specialized service if needed
3. Add rule-based fallback in `RoleResponseService`
4. Update documentation in this directory
