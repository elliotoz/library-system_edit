# OZ AI — Setup Guide

## Quick Start

### Step 1: Install Ollama

1. Download from https://ollama.ai
2. Install for your platform (Windows / Mac / Linux)
3. Ollama runs as a background service on `localhost:11434`

### Step 2: Download Required Models

OZ AI uses two models:

```bash
# Primary chat model — tool calling, multi-turn conversation
ollama pull mistral

# Multimodal model — book cover scanning (admin only, optional)
ollama pull gemma3:4b
```

**Download sizes** (approximate):

| Model | Size | Use |
|-------|------|-----|
| mistral | ~4GB | All chat, tool calls |
| gemma3:4b | ~2GB | Admin book cover scan only |

> **Minimum**: Pull only `mistral` if you don't need cover scanning.

### Step 3: Verify Installation

```bash
# List installed models
ollama list

# Expected output:
# NAME              SIZE    MODIFIED
# mistral:latest    4.1GB   ...
# gemma3:4b:latest  2.0GB   ...

# Test the model
ollama run mistral "Hello"
```

### Step 4: Configure Environment Variable

Add to `apps/api/.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434
```

The default is `localhost:11434`, so this is optional unless Ollama is running elsewhere.

### Step 5: Start the Application

```bash
npm run db:start   # start PostgreSQL
npm run dev        # start API + frontend
```

On startup, the API logs Ollama status:

```
[AgentService] Ollama available — models: mistral:latest, gemma3:4b:latest
```

If Ollama is not running:

```
[AgentService] Ollama not reachable — AI chat unavailable
```

### Step 6: Verify the AI Endpoint

```bash
# Check status (no auth required)
curl http://localhost:3001/ai/status -b cookies.txt
# { "available": true, "models": ["mistral:latest", "gemma3:4b:latest"] }
```

The frontend AI chat page shows a green **AI Online** pill when connected.

---

## Performance Expectations

### GPU (recommended)

| GPU | mistral first token | Subsequent tokens |
|-----|---------------------|------------------|
| RTX 4070 12GB | ~800ms | ~30 tokens/s |
| RTX 3060 8GB | ~1.2s | ~20 tokens/s |
| Apple M2 Pro | ~1s | ~25 tokens/s |

### CPU-only (no GPU)

All models run on CPU but are significantly slower:

| Model | First token | Speed |
|-------|-------------|-------|
| mistral | ~5–10s | ~3–5 tokens/s |
| gemma3:4b | ~3–6s | ~5–8 tokens/s |

CPU mode is functional for development and demo but not recommended for concurrent users.

---

## Troubleshooting

### "AI Offline" / Basic Mode in the frontend

**Cause**: Ollama is not running or not reachable.

**Fix**:

```bash
# Windows: check system tray for Ollama icon, or:
ollama serve

# macOS/Linux:
ollama serve
```

Then refresh the page — status updates automatically on each new chat.

### Model Not Found

```bash
# List what's installed
ollama list

# Pull missing model
ollama pull mistral
```

### Slow Responses

1. Check GPU utilisation in Task Manager / Activity Monitor
2. Close other GPU-intensive applications
3. Consider quantised model variants for lower VRAM:

```bash
ollama pull mistral:7b-instruct-q4_K_M   # 4-bit quantised (~2.5GB)
```

### Out of Memory

```bash
# Use 4-bit quantised mistral (~2.5GB instead of ~4GB)
ollama pull mistral:7b-instruct-q4_K_M
```

Update `agent.service.ts` line with `model: 'mistral'` to match the tag you pulled.

### Cover Scan Not Working

Cover scan requires `gemma3:4b`:

```bash
ollama pull gemma3:4b
```

Only Admin users can access `/ai/scan-cover`.

---

## Docker Setup (Alternative)

To run Ollama in Docker alongside the app:

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

Pull models inside the container:

```bash
docker exec -it ollama ollama pull mistral
docker exec -it ollama ollama pull gemma3:4b
```

---

## Production Considerations

### Cloud GPU

For production without a local GPU:
1. Use a cloud GPU instance (AWS g4dn, GCP T4, Azure NC)
2. Install Ollama on the instance
3. Set `OLLAMA_BASE_URL` to the instance's internal IP

### Security

- Ollama binds to `localhost` by default — not publicly accessible
- Never expose Ollama's port (11434) directly to the internet
- The library API proxies all requests through authenticated NestJS endpoints

### Monitoring

```bash
# Check Ollama health
curl http://localhost:11434/api/tags

# View Ollama logs
journalctl -u ollama         # Linux systemd
# or check the Ollama app on Windows/macOS
```

---

## Quick Reference

```bash
# Start Ollama
ollama serve

# Pull models
ollama pull mistral
ollama pull gemma3:4b

# List installed models
ollama list

# Test a model
ollama run mistral "How many planets are in the solar system?"

# Check API health
curl http://localhost:11434/api/tags
```

**Environment variable**: `OLLAMA_BASE_URL=http://localhost:11434`

**Default port**: `11434`

**Models used**:
- `mistral` — all chat and tool calling
- `gemma3:4b` — admin book cover scanning (multimodal)
