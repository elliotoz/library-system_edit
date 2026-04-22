import { Injectable, Logger } from '@nestjs/common';
import { ToolExecutionContext, ToolResult } from './tool-hooks';

@Injectable()
export class ToolHookService {
  private readonly logger = new Logger(ToolHookService.name);

  async runPreHook(context: ToolExecutionContext): Promise<void> {
    let safeArgs: string;
    try { safeArgs = JSON.stringify(context.arguments); } catch { safeArgs = '[unserializable]'; }
    this.logger.debug(
      `[TOOL:PRE] ${context.toolName} — user=${context.userId} role=${context.userRole} args=${safeArgs}`,
    );
  }

  async runPostHook(context: ToolExecutionContext, result: ToolResult): Promise<void> {
    this.logger.debug(
      `[TOOL:POST] ${context.toolName} — success=${result.success} time=${result.executionTimeMs ?? '?'}ms`,
    );
  }

  async runErrorHook(context: ToolExecutionContext, error: Error): Promise<void> {
    this.logger.warn(
      `[TOOL:ERROR] ${context.toolName} — ${error.message}`,
    );
  }
}
