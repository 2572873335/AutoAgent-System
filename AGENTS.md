# AGENTS.md - Agentic Coding Guidelines

## Project Overview

This is a React 19 + TypeScript + Vite application with an Express backend. It provides an AI-powered task orchestration system that decomposes tasks, discovers/generates agents, and executes them in parallel.

---

## Build & Development Commands

```bash
# Development
npm run dev          # Run both server (port 3001) and client (Vite)
npm run dev:client   # Run client only (Vite on port 5173)
npm run dev:server   # Run server only (Express on port 3001)

# Build
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build

# Linting & Type Checking
npm run lint         # Run ESLint on all files

# Production
npm run start        # Start production server (NODE_ENV=production)
```

**No test framework is currently configured.** To add tests, use `vitest` or `jest` with React Testing Library.

---

## TypeScript Configuration

- **Strict mode enabled** - all strict checks are on
- **Path alias**: `@/*` maps to `./src/*`
- **Target**: ES2022 (browser), ES2023 (node)
- **Module resolution**: Bundler mode
- **JSX**: react-jsx

---

## Code Style Guidelines

### Imports & Path Aliases

```typescript
// Use @ alias for local imports
import { Orchestrator } from '@/services/orchestrator';
import type { Task, Agent } from '@/types';
import { cn } from '@/lib/utils';

// Use relative paths for sibling components
import { Button } from '@/components/ui/button';

// Named imports preferred
import { useState, useEffect } from 'react';
```

### Naming Conventions

- **Files**: kebab-case for components (`AgentCard.tsx`), camelCase for services (`orchestrator.ts`)
- **Types/Interfaces**: PascalCase (`Task`, `AgentConfig`)
- **Functions**: camelCase, verb prefixes (`getInstance`, `submitTask`)
- **Constants**: UPPER_SNAKE_CASE for magic values, camelCase for regular constants
- **Components**: PascalCase (`AgentCard`, `LogViewer`)

### TypeScript Best Practices

- **Always use explicit types** for function parameters and return types
- **Use `type` for simple type aliases**, `interface` for object shapes
- **Use `import type` / `export type`** for type-only imports (required by `verbatimModuleSyntax`)
- **Never use `any`** - use `unknown` if type is truly unknown
- **Enable strict null checks** - check for undefined/null explicitly

```typescript
// ✅ Good
function submitTask(description: string): Promise<Task> { ... }

// ❌ Bad
function submitTask(description) { ... }
```

### React Patterns

- **Use functional components** with hooks only
- **Prefer composition over inheritance**
- **Extract custom hooks** for reusable stateful logic
- **Use `useCallback` / `useMemo`** only when there's measurable performance benefit

```typescript
// Singleton pattern example
export class Orchestrator {
  private static instance: Orchestrator;
  
  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }
  
  private constructor() { ... }
}
```

### Error Handling

- **Use try/catch** for async operations
- **Log errors appropriately**: `console.error` for failures, `console.warn` for recoverable issues
- **Never swallow errors silently** - at minimum log them
- **Provide meaningful error messages** that help debugging

```typescript
try {
  await api.createTask(description);
} catch (error) {
  console.warn('Failed to sync task with backend:', error);
}
```

---

## UI & Styling

### Tailwind CSS

This project uses Tailwind CSS with custom CSS variables for theming.

- **Use `cn()` utility** from `@/lib/utils` to merge Tailwind classes
- **Follow existing color tokens**: `primary`, `secondary`, `muted`, `destructive`, `accent`
- **Use Radix UI primitives** for accessible components

```typescript
import { cn } from '@/lib/utils';

<Button className={cn('px-4 py-2', variant === 'primary' && 'bg-primary')}>
  Click me
</Button>
```

### Component Structure

```
src/
├── components/
│   ├── ui/           # Radix UI based components
│   ├── AgentCard.tsx # Feature components
│   └── ...
├── services/         # Business logic (orchestrator, api, etc.)
├── hooks/            # Custom React hooks
├── lib/              # Utilities (cn, etc.)
└── types/            # TypeScript interfaces
```

---

## Linting Rules

The project uses ESLint with:
- `@eslint/js` - Base JavaScript rules
- `typescript-eslint` - TypeScript support
- `eslint-plugin-react-hooks` - React hooks rules
- `eslint-plugin-react-refresh` - HMR-safe code checks

**Key rules enforced:**
- No unused variables (`noUnusedLocals`, `noUnusedParameters`)
- No fallthrough cases in switch
- React hooks exhaustive deps

Run `npm run lint` before committing.

---

## Common Patterns

### Singleton Services

Use static `getInstance()` pattern for services that should have one instance:

```typescript
export class SomeService {
  private static instance: SomeService;
  
  static getInstance(): SomeService {
    if (!SomeService.instance) {
      SomeService.instance = new SomeService();
    }
    return SomeService.instance;
  }
  
  private constructor() { ... }
}
```

### Event Subscription

Services use Set-based listener pattern:

```typescript
private listeners: Set<(data: T) => void> = new Set();

subscribe(listener: (data: T) => void): () => void {
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);
}

private notify(data: T): void {
  for (const listener of this.listeners) {
    listener(data);
  }
}
```

---

## Key Dependencies

- **React 19** - UI framework
- **Vite 7** - Build tool
- **Express** - Backend server
- **Radix UI** - Accessible UI primitives
- **Tailwind CSS** - Styling
- **Zod** - Schema validation
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **ddgs** - DuckDuckGo search (Python)

---

## Architecture Notes

- **Client**: React SPA on Vite (port 5173)
- **Server**: Express API (port 3001)
- **State**: LocalStorage for persistence, in-memory for runtime
- **API calls**: Kimi LLM integration for task decomposition and agent generation
- **Agent execution**: Sandbox execution or direct API calls
---

## Agent 代码生成规范

### 生成语言要求

**重要**：Agent 代码必须生成**纯 JavaScript**（非 TypeScript），因为后端 sandbox 使用 Node.js 直接执行。

#### 前端生成器 (`src/services/agentGenerator.ts`)

- 使用 `class` 语法
- 使用 `module.exports` 导出
- 参数不带类型声明
- 属性不使用 `private` 关键字

```javascript
// ✅ 正确
class Agent_XXX {
  constructor() {
    this.id = 'agent_xxx';
  }
  
  async execute(input) {
    return { result: 'completed' };
  }
}

module.exports = Agent_XXX;
```

```typescript
// ❌ 错误 - TypeScript 语法无法在 sandbox 执行
export class Agent_XXX {
  private id: string = 'agent_xxx';
  
  async execute(input: any): Promise<any> { ... }
}

export default Agent_XXX;
```

#### 后端 Kimi API 调用 (`server/index.cjs`)

调用 Kimi 生成 Agent 时，system prompt 必须明确要求生成 JavaScript：

```javascript
const systemPrompt = `...
Generate ONLY plain JavaScript code (compatible with Node.js), no TypeScript, no explanations.`;

const userPrompt = `...
IMPORTANT: Output MUST be plain JavaScript that can run in Node.js directly.`;
```

### Agent 类型与技能

系统支持以下 Agent 类型：

| 类型 | 说明 | 技能 |
|------|------|------|
| `researcher` | 研究型 | searchWeb, summarize |
| `analyst` | 分析型 | analyzeData, compare |
| `writer` | 写作型 | generateText, formatOutput |
| `validator` | 验证型 | verify, test |
| `developer` | 开发型 | writeCode, debug |
| `scraper` | 爬取型 | scrapeWeb, parseHTML |
| `api_client` | API 调用型 | makeRequest, handleAuth |
| `general` | 通用型 | execute |

### Sandbox 执行

Agent 代码通过 `/api/sandbox/execute` 端点在隔离环境中执行：

1. 代码写入临时 `.js` 文件
2. 使用 `node` 命令执行
3. 捕获 stdout/stderr
4. 返回执行结果


