# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言设置

**所有回复必须使用中文（简体）**。

## 项目概述

Kimi Agent（自动 Agent 集群构建）是一个 AI 驱动的任务编排系统，能够分解复杂任务、自动生成专用 Agent 并并行执行。

**技术栈：**
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Radix UI
- **后端**: Express + Node.js (CommonJS)
- **AI**: DeepSeek API (模型: `deepseek-chat`)
- **搜索**: DuckDuckGo HTML 搜索（免费，无需 API Key）
- **图像生成**: Stability AI / DALL-E (免费额度)
- **构建工具**: Vite 7，使用 `@/*` 路径别名映射到 `./src/*`

## 常用命令

```bash
# 开发模式（同时启动前端和后端）
npm run dev              # 客户端端口 5173 + 服务端端口 3001
npm run dev:client       # 仅前端 (Vite, 端口 5173)
npm run dev:server       # 仅后端 (Express, 端口 3001)

# 构建与生产
npm run build            # TypeScript 编译 + Vite 生产构建
npm run preview          # 预览生产构建
npm run start            # 生产环境启动 (NODE_ENV=production)

# 代码检查
npm run lint             # ESLint (typescript-eslint + react-hooks 规则)

# 测试
# 注意：当前未配置测试框架。如需添加测试，使用 vitest 或 jest + React Testing Library
```

## 架构设计

### 前后端通信

- **客户端** (端口 5173): Vite 开发的 React SPA
- **服务端** (端口 3001): Express API，启用 CORS
- 所有 API 请求发送到 `http://localhost:3001/api/*`
- 状态持久化到 LocalStorage；后端提供 LLM API 代理和沙箱执行

### 核心服务（单例模式）

所有服务类使用静态 `getInstance()` 模式和基于 Set 的事件订阅：

```typescript
export class Orchestrator {
  private static instance: Orchestrator;
  private listeners: Set<(task: Task) => void> = new Set();

  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  subscribe(listener: (task: Task) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private constructor() { /* ... */ }
}
```

**核心服务：**
- `Orchestrator` (`src/services/orchestrator.ts`) - 任务分解、Agent 协调、执行计划
- `AgentGenerator` (`src/services/agentGenerator.ts`) - 根据任务描述生成 JavaScript Agent 代码
- `GitHubSearcher` (`src/services/githubSearcher.ts`) - 从 GitHub 搜索可复用的 Agent
- `api.ts` (`src/services/api.ts`) - 后端 API 的 HTTP 客户端

### Agent 代码生成（关键约束）

**Agent 代码必须是纯 JavaScript**（不能是 TypeScript），因为它通过 `child_process.exec` 在 Node.js 沙箱中执行。

前端生成器输出：
```javascript
// 正确 - 使用 class 和 module.exports
class Agent_XXX {
  constructor() { this.id = 'agent_xxx'; }
  async execute(input) { return { result: 'done' }; }
}
module.exports = Agent_XXX;
```

### 联网搜索功能

对于研究类任务（包含 research/search/latest/trends 等关键词），系统会自动：
1. 使用 DuckDuckGo HTML 进行免费网页搜索
2. 提取搜索结果标题和摘要
3. 使用 DeepSeek AI 总结搜索结果

### Claude Code Web Search Skill

项目提供了独立的 Python 搜索工具，可直接在 Claude Code 中使用：

**文件**: `tools/search_tool.py`

**安装依赖**:
```bash
pip install ddgs
```

**使用方式**:
```bash
# 基本搜索
python tools/search_tool.py "搜索关键词"

# 指定结果数量
python tools/search_tool.py "关键词" -n 10

# JSON 格式输出（便于程序处理）
python tools/search_tool.py "关键词" --json
```

**特性**:
- 使用 `ddgs` 库（DuckDuckGo 免费搜索）
- 默认获取美国英文区域结果
- 支持自定义结果数量
- 可选 JSON 格式输出

### PPT 生成工具

项目提供了 PPT 生成工具 `tools/ppt_generator.py`：

**安装依赖**:
```bash
pip install python-pptx
```

**使用方式**:
```bash
# 基本用法
python tools/ppt_generator.py --title "标题" --slides "内容1|内容2|内容3" --output output.pptx

# 使用 JSON 配置文件
python tools/ppt_generator.py --json slides.json --output output.pptx
```

**JSON 格式**:
```json
[
  {"type": "title", "title": "封面标题", "subtitle": "副标题"},
  {"type": "content", "title": "内容标题", "content": ["要点1", "要点2"]},
  {"type": "summary", "title": "总结", "points": ["结论1", "结论2"]},
  {"type": "closing", "title": "感谢聆听", "subtitle": "问答环节"}
]
```

### 问题诊断与解决 Skill

项目提供了诊断工具 `tools/diagnose.py`，可快速诊断和解决常见问题：

**安装诊断工具依赖**:
```bash
pip install ddgs
```

**使用方式**:
```bash
# 全面诊断
python tools/diagnose.py

# 仅检查 API 服务
python tools/diagnose.py --check-api

# 仅检查搜索功能
python tools/diagnose.py --check-search

# 启动服务
python tools/diagnose.py --start

# 修复 ddgs 安装
python tools/diagnose.py --fix-ddgs
```

**诊断内容**:
- Python/Node.js 版本检查
- npm 依赖检查
- .env 配置检查
- 后端 API 服务状态
- 前端服务状态
- 搜索功能测试

**常见问题解决方案**:

| 问题 | 解决方案 |
|------|----------|
| 搜索返回中文结果 | 使用 `python tools/search_tool.py` 替代后端 API |
| ddgs 未安装 | `pip install ddgs` |
| API 服务未运行 | `npm run dev` |
| PDF 生成失败 | 检查 `server/generated-pdfs` 目录权限 |

后端 API 端点（`server/index.cjs`）：
- `POST /api/kimi/decompose-task` - LLM 任务分解
- `POST /api/kimi/generate-agent` - 生成 Agent JavaScript 代码
- `POST /api/kimi/execute` - 执行子任务（研究任务自动使用搜索）
- `POST /api/search` - 直接调用网页搜索
- `POST /api/sandbox/execute` - 在沙箱中执行代码
- `POST /api/generate-pdf` - 生成 PDF 报告

### 图像生成功能

系统支持多种图像生成方式，通过 `server/services/imageGenerator.cjs` 实现：

**支持的 API：**
| API | 免费额度 | 说明 |
|-----|----------|------|
| Stability AI | ✅ 免费 25 积分 | 推荐，稳定可靠 |
| DALL-E | ⚠️ 有免费额 | 需要 OpenAI API Key |

**环境配置：**
```bash
# Stability AI (推荐)
STABILITY_API_KEY=sk-your-stability-key

# 或 OpenAI DALL-E
OPENAI_API_KEY=sk-your-openai-key
```

**使用方式：**
系统会自动识别图像生成任务（如"生成图片"、"分镜"、"视频"等关键词），并调用图像生成 API。

## 环境变量配置

创建 `.env` 文件：

```bash
# DeepSeek API (任务执行)
DEEPSEEK_API_KEY=your-deepseek-key

# 图像生成 API (免费)
# Stability AI: https://platform.stability.ai/
STABILITY_API_KEY=your-stability-key

# 或 OpenAI DALL-E
# OPENAI_API_KEY=your-openai-key

PORT=3001
VITE_API_URL=http://localhost:3001/api
```

**注意**：
- 联网搜索使用 DuckDuckGo HTML（免费），无需额外 API Key
- 图像生成推荐使用 Stability AI（新用户免费 25 积分）

## TypeScript 配置

- **严格模式** 启用，包含 `noUnusedLocals`、`noUnusedParameters`
- **路径别名**: `@/*` 映射到 `./src/*`
- **模块**: ESNext + bundler 解析
- **JSX**: `react-jsx`
- **目标**: ES2022
- **类型导入**: 必须使用 `import type`（`verbatimModuleSyntax` 要求）

## 代码规范

- 导入使用 `@/` 别名: `import { Orchestrator } from '@/services/orchestrator'`
- Tailwind 类名合并使用 `cn()` 工具函数（来自 `@/lib/utils`）
- 组件/类型使用 PascalCase，函数/变量使用 camelCase
- 禁止使用 `any`，使用显式类型

## 后端说明

- 服务端文件为 `server/index.cjs`（CommonJS，非 ES 模块）
- 使用内存存储（Map）管理用户、任务和执行记录
- 沙箱执行：代码写入临时 `.cjs` 文件，通过 `node` 命令执行
- 支持从 `.env` 文件加载环境变量

## 参考文档

- `AGENTS.md` - 详细代码规范、Agent 代码生成规则、命名约定
- `info.md` - 组件列表、API 端点参考
- `.claude.md` - 全局语言规则
