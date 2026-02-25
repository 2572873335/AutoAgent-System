# Kimi Agent 自动 Agent 集群构建

一个 AI 驱动的任务编排系统，能够分解任务、自动发现/生成 Agent，并行执行任务。

## 功能特性

- **任务分解**：使用 Kimi LLM 将复杂任务拆分为可执行的子任务
- **Agent 自动生成**：根据子任务需求自动生成专用 Agent
- **并行执行**：智能调度多个 Agent 并行执行任务
- **GitHub Agent 发现**：从 GitHub 仓库搜索可复用的 Agent
- **沙箱执行**：安全隔离的代码执行环境
- **实时日志**：任务执行过程全程可追踪

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Radix UI
- **后端**：Express + Node.js
- **AI**：DeepSeek API (deepseek-chat)
- **搜索**：DuckDuckGo (ddgs 库)
- **代码执行**：Node.js Sandbox

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

同时运行前端和后端：

```bash
npm run dev
```

或分别运行：

```bash
npm run dev:client   # 前端 (Vite, 端口 5173)
npm run dev:server   # 后端 (Express, 端口 3001)
```

### 打开浏览器

访问 http://localhost:5173

## 命令列表

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（前端 + 后端） |
| `npm run dev:client` | 仅前端开发 |
| `npm run dev:server` | 仅后端开发 |
| `npm run build` | TypeScript 编译 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run start` | 生产环境启动 |

## 工具脚本

项目提供了以下 Python 工具脚本：

### 搜索工具 (`tools/search_tool.py`)

```bash
# 安装依赖
pip install ddgs

# 基本搜索
python tools/search_tool.py "关键词"

# 指定结果数量
python tools/search_tool.py "关键词" -n 10

# JSON 格式输出
python tools/search_tool.py "关键词" --json
```

### 诊断工具 (`tools/diagnose.py`)

```bash
# 全面诊断
python tools/diagnose.py

# 检查 API 服务
python tools/diagnose.py --check-api

# 启动服务
python tools/diagnose.py --start

# 修复搜索问题
python tools/diagnose.py --fix-ddgs
```

### PPT 生成工具 (`tools/ppt_generator.py`)

```bash
# 安装依赖
pip install python-pptx

# 基本用法
python tools/ppt_generator.py --title "标题" --slides "内容1|内容2|内容3" --output output.pptx

# 使用 JSON 配置文件
python tools/ppt_generator.py --json slides.json --output output.pptx
```

## 使用方法

1. 在任务输入框中描述你的任务（如 "Research the latest AI trends and summarize findings"）
2. 系统自动将任务分解为子任务
3. 为每个子任务生成或复用 Agent
4. 并行执行 Agent 并收集结果
5. 查看完整的执行报告

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/          # React 组件
│   │   ├── ui/             # Radix UI 组件
│   │   └── *.tsx           # 业务组件
│   ├── services/           # 业务逻辑
│   │   ├── orchestrator.ts # 任务编排器
│   │   ├── agentGenerator.ts # Agent 生成器
│   │   ├── githubSearcher.ts # GitHub 搜索
│   │   └── api.ts           # API 服务
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具函数
│   └── types/              # TypeScript 类型
├── server/                 # 后端源码
│   └── index.cjs           # Express 服务
└── dist/                   # 生产构建输出
```

## 配置

### DeepSeek API

在 `.env` 文件中配置你的 DeepSeek API Key：

```bash
DEEPSEEK_API_KEY=your-deepseek-key
PORT=3001
VITE_API_URL=http://localhost:3001/api
```

### 环境变量

- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `VITE_API_URL` - 后端 API 地址（默认 http://localhost:3001/api）
- `PORT` - 服务器端口（默认 3001）
- `NODE_ENV` - 运行环境

## 许可证

MIT
