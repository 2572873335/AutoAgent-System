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

**旧版端点（已弃用）：**
- `POST /api/kimi/decompose-task` - LLM 任务分解（弃用）
- `POST /api/kimi/generate-agent` - 生成 Agent JavaScript 代码（弃用）
- `POST /api/kimi/execute` - 执行子任务（弃用）

**新版工具系统：**
- `POST /api/agent/execute-stream` - SSE 流式任务执行（支持工具调用）
- `GET /api/tools/list` - 获取可用工具列表
- `GET /api/files/:taskId/:filename` - 安全下载任务生成的文件

**其他端点：**
- `POST /api/search` - 直接调用网页搜索
- `POST /api/sandbox/execute` - 在沙箱中执行代码
- `POST /api/generate-pdf` - 生成 PDF 报告
- `GET /api/pdfs/:filename` - 获取 PDF 文件

### 新工具系统架构（Function Calling）

后端实现了基于 DeepSeek Function Calling 的工具系统，替代了旧版 Agent 生成方式：

**执行流程：**
1. **规划阶段** - DeepSeek 分析任务，决定调用哪些工具
2. **执行阶段** - 并行执行所有工具调用（最大并发数：5）
3. **合成阶段** - 将工具结果反馈给 LLM 生成最终回答

**SSE 流式输出：**
前端通过 EventSource 接收实时更新：
- `init` - 任务初始化
- `thought` - 思考/规划状态更新
- `tool_start` - 工具开始执行
- `tool_result` - 工具执行结果
- `final` - 最终回答
- `error` - 错误信息

**工作空间隔离：**
每个任务有独立的工作目录 `temp/{taskId}/`，工具生成的文件保存在此目录，通过 `/api/files/{taskId}/{filename}` 安全下载。

**并发控制：**
使用自定义的 p-limit 兼容实现，最大并发数为 5。

**定时清理：**
使用 `node-cron` 每小时清理超过 24 小时的临时目录。

### 图像生成功能

系统支持多种图像生成方式，通过 `server/services/imageGenerator.cjs` 实现：

**支持的 API：**
| API | 免费额度 | 说明 |
|-----|----------|------|
| MiniMax | ✅ 免费额度 | 主要使用的图像生成服务（推荐） |
| Stability AI | ✅ 免费 25 积分 | 备选方案 |
| DALL-E | ⚠️ 有免费额 | 需要 OpenAI API Key |

**环境配置：**
```bash
# MiniMax API（图像生成，推荐）
MINIMAX_API_KEY=your-minimax-key

# Stability AI（备选）
STABILITY_API_KEY=sk-your-stability-key

# 或 OpenAI DALL-E
# OPENAI_API_KEY=sk-your-openai-key
```

**使用方式：**
系统会自动识别图像生成任务（如"生成图片"、"分镜"、"视频"等关键词），并调用图像生成 API。批量生成（>5张）会自动拆分并行执行。

## 环境变量配置

创建 `.env` 文件：

```bash
# DeepSeek API (任务执行)
DEEPSEEK_API_KEY=your-deepseek-key

# 图像生成 API (免费)
# MiniMax (推荐): https://platform.minimaxi.com/
MINIMAX_API_KEY=your-minimax-key

# 或 Stability AI: https://platform.stability.ai/
STABILITY_API_KEY=your-stability-key

# 或 OpenAI DALL-E
# OPENAI_API_KEY=your-openai-key

PORT=3001
VITE_API_URL=http://localhost:3001/api
```

**注意**：
- 联网搜索使用 DuckDuckGo HTML（免费），无需额外 API Key
- 图像生成推荐使用 MiniMax 或 Stability AI

## TypeScript 配置

- **严格模式** 启用，包含 `noUnusedLocals`、`noUnusedParameters`
- **路径别名**: `@/*` 映射到 `./src/*`
- **模块**: ESNext + bundler 解析
- **JSX**: `react-jsx`
- **目标**: ES2022
- **类型导入**: 必须使用 `import type`（`verbatimModuleSyntax` 要求）

## ESLint 配置

- `@eslint/js` - Base JavaScript rules
- `typescript-eslint` - TypeScript 支持
- `eslint-plugin-react-hooks` - React hooks 规则
- `eslint-plugin-react-refresh` - HMR-safe code checks

**特殊规则：**
- `src/components/ui/**/*.tsx` 目录关闭了 `react-refresh/only-export-components`，允许同时导出组件和 variant
- `noUnusedLocals`、`noUnusedParameters` - 禁止未使用的变量和参数

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

**并发控制：**
- 最大并发任务数：5（使用 p-limit 兼容实现）

**临时目录结构：**
```
temp/
├── {taskId}/           # 任务工作空间
│   ├── slides_config.json  # PPT 配置文件
│   ├── presentation.pptx   # 生成的 PPT
│   └── ...
code-sandbox/
├── exec_{uuid}.cjs     # 沙箱执行的临时代码文件
generated-pdfs/
└── {filename}.pdf      # 生成的 PDF 文件
```

**定时清理：**
- 每小时自动清理超过 24 小时的临时目录（使用 `node-cron`）
- 启动时执行一次清理

## Skills 系统

项目集成了 Claude Code Skills（位于 `skills/` 目录），用于增强 Claude Code 的交互能力和提供专业领域指导。

### Skill 文件格式

每个 Skill 是一个包含 frontmatter 的 Markdown 文件 (`SKILL.md`)：

```yaml
---
name: skill-name
description: "Skill description for matching"
metadata: {"nanobot": {"emoji": "🦞", "requires": {"bins": ["gh"]}}}
---

# Skill 内容

具体的使用指南、命令示例等...
```

### 可用 Skills

| Skill | 用途 | 触发条件 |
|-------|------|----------|
| `github` | GitHub CLI 操作 | PR、Issue、CI 相关任务 |
| `doc-coauthoring` | 文档协作编写 | 编写技术文档、PRD、RFC |
| `mcp-builder` | MCP Server 开发 | 构建 Model Context Protocol 服务 |
| `clawhub` | Skill 注册表搜索 | "find a skill", "install skill" |
| `canvas-design` | Canvas 设计 | 图像/字体设计任务 |
| `algorithmic-art` | 算法艺术生成 | 程序化艺术生成 |
| `docx` | Word 文档处理 | .docx 文件操作 |
| `frontend-design` | 前端设计 | UI/UX 设计任务 |
| `brand-guidelines` | 品牌规范 | 品牌一致性检查 |
| `cron` | 定时任务 | cron 表达式相关 |
| `internal-comms` | 内部沟通 | 团队沟通文档 |
| `pdf` | PDF 处理 | PDF 生成与处理 |
| `memory` | 记忆管理 | 长期记忆相关 |

### ClawHub Skill 注册表

使用 ClawHub 搜索和安装公共 Skills：

```bash
# 搜索技能
npx --yes clawhub@latest search "web scraping" --limit 5

# 安装技能
npx --yes clawhub@latest install <slug> --workdir ~/.nanobot/workspace

# 更新所有技能
npx --yes clawhub@latest update --all --workdir ~/.nanobot/workspace

# 列出已安装
npx --yes clawhub@latest list --workdir ~/.nanobot/workspace
```

**注意**：安装后需要重启 Claude Code 会话以加载新 Skill。

## 参考文档

- `AGENTS.md` - 详细代码规范、Agent 代码生成规则、命名约定
- `info.md` - 组件列表、API 端点参考
- `.claude.md` - 全局语言规则
