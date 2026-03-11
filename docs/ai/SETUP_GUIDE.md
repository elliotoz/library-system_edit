# AI Setup Guide

## Quick Start (10 minutes)

### Step 1: Install Ollama

1. Download from https://ollama.ai
2. Install for your platform (Windows/Mac/Linux)
3. Ollama runs as a background service on `localhost:11434`

### Step 2: Download Required Models

The system uses **three models** for different purposes:

```bash
# Primary model for Students and Instructors (balanced)
ollama pull qwen2.5

# Lightweight model for Staff and simple queries (fast)
ollama pull phi3

# Advanced model for Admin and deep reasoning (capable)
ollama pull llama3
```

**Download times** (approximate):

| Model | Size | Time (100Mbps) |
|-------|------|----------------|
| phi3 | ~2GB | 3-5 min |
| qwen2.5 | ~4GB | 6-10 min |
| llama3 | ~4GB | 6-10 min |

### Step 3: Verify Installation

```bash
# List installed models
ollama list

# Expected output:
# NAME       SIZE    MODIFIED
# phi3       2.3GB   ...
# qwen2.5    4.4GB   ...
# llama3     4.7GB   ...

# Test a model
ollama run phi3 "Hello, how are you?"
```

### Step 4: Configure Environment Variable

Add to `apps/api/.env`:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
```

The default is `localhost:11434`, so this is optional unless running Ollama elsewhere.

### Step 5: Start the Application

```bash
# Start database
npm run db:start

# Start development servers
npm run dev
```

The AI module automatically:
- Checks Ollama connectivity on startup
- Logs status: `Ollama connected at http://localhost:11434`
- Falls back gracefully if Ollama unavailable

### Step 6: Test the AI Endpoint

```bash
# Login first to get JWT cookie
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@test.com", "password": "password"}' \
  -c cookies.txt

# Test AI chat
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message": "How many books can I borrow?"}'

# Expected response:
# {
#   "reply": "Your Borrowing Status:\n- Active borrows: 0 / 5\n...",
#   "modelUsed": "rule-based",
#   "sources": ["/dashboard/borrowed"]
# }
```

---

## Model Selection Logic

### Query Type Detection

```
Deep Reasoning triggers:
- "analytics", "compare", "trend", "why", "forecast"
- "analyze", "correlation", "insight", "explain why", "what if"
-> Always uses: llama3

Simple Query triggers:
- "how do i", "what is the policy", "when is", "where is"
- "how many days", "can i borrow", "opening hours", "how to"
-> Always uses: phi3
```

### Default by Role

| Role | Model | Rationale |
|------|-------|-----------|
| STAFF | phi3 | Fast responses, simple queries |
| STUDENT | qwen2.5 | Balanced quality/speed |
| INSTRUCTOR | qwen2.5 | Balanced quality/speed |
| ADMIN | llama3 | Complex operational queries |

---

## Performance Expectations

### RTX 4070 (12GB VRAM)

| Model | First Response | Subsequent | Tokens/sec |
|-------|----------------|------------|------------|
| phi3 | 1-2 sec | <1 sec | ~30-40 |
| qwen2.5 | 2-3 sec | 1-2 sec | ~20-25 |
| llama3 | 3-4 sec | 2-3 sec | ~15-20 |

### Lower-end GPU (8GB VRAM)

Recommendation: Use only `phi3` and `qwen2.5`

```bash
# Skip llama3 if VRAM is limited
ollama pull phi3
ollama pull qwen2.5
```

The system will still work - `llama3` requests fall back to `qwen2.5`.

### CPU-only (No GPU)

All models run on CPU but slower:
- phi3: ~5-10 sec per response
- qwen2.5: ~10-15 sec per response
- llama3: ~15-25 sec per response

---

## Troubleshooting

### "Ollama not reachable" Warning on Startup

```
[Nest] LOG   [OllamaService] Ollama not reachable at http://localhost:11434
  - AI chat will fall back to rule-based responses
```

**Solution**: Start Ollama

```bash
# macOS/Linux
ollama serve

# Windows: Ollama runs as a service, check system tray
```

### Model Not Found Error

```bash
# Check installed models
ollama list

# Pull missing model
ollama pull qwen2.5
```

### Slow Responses

1. Check GPU usage in task manager
2. Close other GPU-intensive applications
3. Switch to lighter model (phi3)

### Out of Memory

```bash
# Use quantized models for lower memory:
ollama pull phi3:3.8b-mini-4k-instruct-q4_K_M
```

---

## Graceful Degradation

When Ollama is unavailable, the system automatically falls back to **rule-based responses**:

### Ollama Available

```
User: "What books should I read about machine learning?"
-> Ollama generates personalized recommendation
-> modelUsed: "qwen2.5"
```

### Ollama Unavailable

```
User: "What books should I read about machine learning?"
-> CatalogSearchService searches catalog
-> Returns formatted book list
-> modelUsed: "rule-based"
```

### Fallback Behavior

| Query Type | Ollama Available | Ollama Unavailable |
|------------|------------------|-------------------|
| Book search | LLM enhanced | Catalog search only |
| Borrowing info | LLM response | Rule-based response |
| Learning path | LLM descriptions | DB-only path |
| Research help | LLM landscape | Resource list only |

---

## Docker Setup (Alternative)

If you prefer to run Ollama in Docker:

```yaml
# Add to docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama_data:
```

Then pull models:

```bash
docker exec -it ollama ollama pull qwen2.5
docker exec -it ollama ollama pull phi3
docker exec -it ollama ollama pull llama3
```

---

## Production Considerations

### Cloud Deployment

For production without local GPU:
1. Use a cloud GPU instance (AWS, GCP, Azure)
2. Or switch to cloud LLM API (OpenAI, Anthropic)
3. Update `OllamaService` to use cloud API

### Security

- Ollama runs locally - no data leaves your machine
- No API keys required
- Consider network isolation in production

### Monitoring

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# View Ollama logs
journalctl -u ollama  # Linux
# or check Ollama app logs on Windows/macOS
```

---

## Quick Reference

```bash
# Start Ollama
ollama serve

# Pull models
ollama pull phi3 qwen2.5 llama3

# List models
ollama list

# Test model
ollama run qwen2.5 "Hello"

# Check API
curl http://localhost:11434/api/tags
```

**Environment Variable**: `OLLAMA_BASE_URL=http://localhost:11434`

**Default Port**: 11434

**Models Used**:
- `phi3` - Staff, simple queries
- `qwen2.5` - Students, Instructors
- `llama3` - Admin, complex queries
