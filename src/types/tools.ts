/**
 * 工具相关类型定义
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool: string;
  callId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface DownloadItem {
  name: string;
  url: string;
  size?: string;
}

export interface StreamState {
  status: 'idle' | 'planning' | 'executing' | 'synthesizing' | 'completed' | 'error';
  thought: string;
  steps: {
    id: string;
    tool: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: unknown;
    error?: string;
  }[];
  finalAnswer: string;
  downloads: DownloadItem[];
  error: string | null;
  taskId: string | null;
}

export interface SSEEvent {
  event: 'init' | 'thought' | 'tool_start' | 'tool_result' | 'final' | 'error';
  data: unknown;
}
