from fastapi import FastAPI

from .executor import execute_python
from .schemas import ExecuteRequest, ExecuteResponse

app = FastAPI(title="OZ Python Runner", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/execute", response_model=ExecuteResponse)
def execute(request: ExecuteRequest) -> ExecuteResponse:
    return execute_python(request.code, request.timeoutMs)
