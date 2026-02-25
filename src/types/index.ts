// AutoAgent System - Core Types

export interface Agent {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  status: 'idle' | 'running' | 'completed' | 'error';
  code?: string;
  language?: string;
  source: 'generated' | 'github' | 'local';
  githubUrl?: string;
  createdAt: number;
  completedAt?: number;
  result?: AgentResult;
  error?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  implementation?: string;
}

export interface Parameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface AgentResult {
  output: string;
  data?: unknown;
  logs: string[];
  executionTime: number;
}

export interface SubTask {
  id: string;
  description: string;
  agentId?: string;
  dependencies: string[];
  status: 'pending' | 'waiting' | 'running' | 'completed' | 'error';
  input: Record<string, unknown>;
  output?: unknown;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'analyzing' | 'planning' | 'executing' | 'completed' | 'error';
  subTasks: SubTask[];
  agents: Agent[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  agentId?: string;
  subTaskId?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  language: string;
  topics: string[];
  readme?: string;
}

export interface ExecutionPlan {
  parallelGroups: string[][];
  dependencies: Record<string, string[]>;
  estimatedTime: number;
}

export type ViewMode = 'dashboard' | 'agents' | 'execution' | 'result';

// Export tool types
export * from './tools';
