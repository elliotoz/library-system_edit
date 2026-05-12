from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    code: str = Field(min_length=1, max_length=12000)
    timeoutMs: int | None = Field(default=None, ge=100, le=8000)


class ExecutionArtifact(BaseModel):
    name: str
    mimeType: str
    base64: str


class ExecuteResponse(BaseModel):
    ok: bool
    stdout: str
    stderr: str
    result: object | None = None
    artifacts: list[ExecutionArtifact] = Field(default_factory=list)
    executionMs: int
    error: str | None = None
