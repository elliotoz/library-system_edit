from app.executor import execute_python


def test_executes_simple_stdout() -> None:
    result = execute_python("print(2 + 2)")

    assert result.ok is True
    assert result.stdout == "4\n"
    assert result.stderr == ""


def test_times_out_long_running_code() -> None:
    result = execute_python("while True:\n    pass", timeout_ms=200)

    assert result.ok is False
    assert result.error == "timeout"


def test_blocks_unsafe_imports() -> None:
    result = execute_python("import os\nprint(os.listdir('.'))")

    assert result.ok is False
    assert result.error == "blocked_code"


def test_truncates_oversized_output() -> None:
    result = execute_python("print('x' * 20000)")

    assert result.ok is True
    assert "[truncated]" in result.stdout


def test_returns_safe_runtime_error() -> None:
    result = execute_python("print(1 / 0)")

    assert result.ok is False
    assert result.error == "runtime_error"
    assert "ZeroDivisionError" in result.stderr
