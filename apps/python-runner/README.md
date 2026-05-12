# OZ Python Runner

Internal FastAPI service for bounded scientific Python execution.

The API service calls this runner through `PYTHON_RUNNER_URL`. The browser
should not call this service directly.

## Endpoints

```http
GET /health
POST /execute
```

## Limits

- code size: 12000 characters
- default timeout: 3000 ms
- max timeout: 8000 ms
- stdout truncation: 12000 characters
- stderr truncation: 8000 characters

## Security Notes

This runner is isolated from the NestJS API process and runs as a non-root
container user. It blocks common unsafe imports and runtime calls before
execution, runs code from a temporary directory, uses `python -I`, and deletes
temporary files after each request.

For production deployments, also enforce container-level controls:

- no public port exposure
- memory and CPU limits
- disabled outbound network
- read-only filesystem where practical
- dropped Linux capabilities

## Local Test

```powershell
python -m pytest
```
