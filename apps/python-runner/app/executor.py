import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from .schemas import ExecuteResponse

DEFAULT_TIMEOUT_MS = 3000
MAX_STDOUT = 12000
MAX_STDERR = 8000

BLOCKED_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bimport\s+os\b",
        r"\bfrom\s+os\b",
        r"\bimport\s+subprocess\b",
        r"\bfrom\s+subprocess\b",
        r"\bimport\s+socket\b",
        r"\bfrom\s+socket\b",
        r"\bimport\s+requests\b",
        r"\bfrom\s+requests\b",
        r"\bimport\s+urllib\b",
        r"\bfrom\s+urllib\b",
        r"\bimport\s+pathlib\b",
        r"\bfrom\s+pathlib\b",
        r"\bopen\s*\(",
        r"\bexec\s*\(",
        r"\beval\s*\(",
        r"\bcompile\s*\(",
        r"\binput\s*\(",
        r"__import__",
        r"__builtins__",
        r"\bglobals\s*\(",
        r"\blocals\s*\(",
    ]
)


def execute_python(code: str, timeout_ms: int | None = None) -> ExecuteResponse:
    start = time.monotonic()
    timeout = (timeout_ms or DEFAULT_TIMEOUT_MS) / 1000

    blocked = find_blocked_pattern(code)
    if blocked:
        return ExecuteResponse(
            ok=False,
            stdout="",
            stderr="Blocked unsafe Python code",
            error="blocked_code",
            artifacts=[],
            executionMs=elapsed_ms(start),
        )

    with tempfile.TemporaryDirectory(prefix="oz-python-") as tmp:
        workdir = Path(tmp)
        script = workdir / "main.py"
        script.write_text(build_script(code), encoding="utf-8")

        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script)],
                cwd=workdir,
                env={
                    "MPLBACKEND": "Agg",
                    "PYTHONIOENCODING": "utf-8",
                },
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            return ExecuteResponse(
                ok=False,
                stdout=truncate(exc.stdout or "", MAX_STDOUT),
                stderr="Execution timed out",
                error="timeout",
                artifacts=[],
                executionMs=elapsed_ms(start),
            )

        return ExecuteResponse(
            ok=proc.returncode == 0,
            stdout=truncate(proc.stdout, MAX_STDOUT),
            stderr=truncate(proc.stderr, MAX_STDERR),
            error=None if proc.returncode == 0 else "runtime_error",
            artifacts=[],
            executionMs=elapsed_ms(start),
        )


def build_script(code: str) -> str:
    return "\n".join([
        "import matplotlib",
        "matplotlib.use('Agg')",
        code,
        "",
    ])


def find_blocked_pattern(code: str) -> str | None:
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(code):
            return pattern.pattern
    return None


def truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + "\n[truncated]"


def elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)
