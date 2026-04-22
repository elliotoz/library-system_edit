export interface ToolExecutionContext {
  toolName: string;
  arguments: Record<string, unknown>;
  userId: string;
  userRole: string;
  timestamp: Date;
}

export interface ToolResult {
  success: boolean;
  data: string;
  executionTimeMs?: number;
}

export type ToolPreHook = (context: ToolExecutionContext) => Promise<void>;
export type ToolPostHook = (context: ToolExecutionContext, result: ToolResult) => Promise<void>;
export type ToolErrorHook = (context: ToolExecutionContext, error: Error) => Promise<void>;

export interface ToolHooks {
  preExecute?: ToolPreHook;
  postExecute?: ToolPostHook;
  onError?: ToolErrorHook;
}
