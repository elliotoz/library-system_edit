import { Injectable, Logger } from '@nestjs/common';

export interface PythonExecutionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  result: unknown | null;
  artifacts: Array<{ name: string; mimeType: string; base64: string }>;
  executionMs: number;
  error?: string | null;
}

@Injectable()
export class PythonExecutionService {
  private readonly logger = new Logger(PythonExecutionService.name);
  private readonly maxCodeLength = 12000;
  private readonly defaultTimeoutMs = Number(process.env.PYTHON_RUNNER_TIMEOUT_MS ?? 3000);
  private readonly maxTimeoutMs = 8000;

  isAvailable(): boolean {
    return !!process.env.PYTHON_RUNNER_URL;
  }

  async execute(code: string, timeoutMs?: number): Promise<PythonExecutionResult> {
    const runnerUrl = process.env.PYTHON_RUNNER_URL;
    if (!runnerUrl) {
      return this.unavailable('Python calculation tool is not configured.');
    }

    if (code.length > this.maxCodeLength) {
      return this.unavailable('Python code is too large to execute safely.');
    }

    const effectiveTimeout = Math.min(
      Math.max(timeoutMs ?? this.defaultTimeoutMs, 100),
      this.maxTimeoutMs,
    );

    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), effectiveTimeout + 1000);

    try {
      const res = await fetch(`${runnerUrl.replace(/\/$/, '')}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeoutMs: effectiveTimeout }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Python runner returned HTTP ${res.status}`);
        return this.unavailable('Python calculation tool returned an error.');
      }

      return await res.json() as PythonExecutionResult;
    } catch (err) {
      this.logger.warn(`Python runner unavailable: ${String(err)}`);
      return this.unavailable('Python calculation tool is unavailable.');
    } finally {
      clearTimeout(abort);
    }
  }

  private unavailable(message: string): PythonExecutionResult {
    return {
      ok: false,
      stdout: '',
      stderr: message,
      result: null,
      artifacts: [],
      executionMs: 0,
      error: 'unavailable',
    };
  }
}
