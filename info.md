# 项目配置信息

## 运行环境

- Node.js v20+
- Vite v7
- React 19
- Python 3.8+ (用于搜索工具)

## UI 框架

- Tailwind CSS v3.4.x (shadcn/ui 主题)
- Radix UI (40+ 组件)

## 组件列表

```
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb,
button-group, button, calendar, card, carousel, chart, checkbox, collapsible,
command, context-menu, dialog, drawer, dropdown-menu, empty, field, form,
hover-card, input-group, input-otp, input, item, kbd, label, menubar,
navigation-menu, pagination, popover, progress, radio-group, resizable,
scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner,
spinner, switch, table, tabs, textarea, toggle-group, toggle, tooltip
```

## 项目结构

```
src/
├── components/          # React 组件
│   ├── ui/             # Radix UI 组件
│   └── *.tsx           # 业务组件
├── services/           # 业务逻辑
│   ├── orchestrator.ts # 任务编排器
│   ├── agentGenerator.ts # Agent 生成器
│   ├── githubSearcher.ts # GitHub 搜索
│   └── api.ts          # API 服务
├── hooks/              # 自定义 Hooks
├── lib/                # 工具函数
└── types/              # TypeScript 类型

server/
└── index.cjs           # Express 后端服务

tools/                  # Python 工具脚本
├── search_tool.py      # DuckDuckGo 搜索工具
└── diagnose.py         # 问题诊断工具

code-sandbox/           # Agent 代码沙箱目录
data/                   # 数据存储目录
```

## 核心服务

### Orchestrator (任务编排器)

负责：
- 任务提交与状态管理
- 任务分解 (使用 Kimi API)
- Agent 发现与生成
- 执行计划创建与执行
- 结果聚合

### AgentGenerator (Agent 生成器)

负责：
- 根据任务类型确定 Agent 类型
- 生成技能模板
- 生成可执行的 JavaScript 代码

### GitHubSearcher (GitHub 搜索)

负责：
- 从 GitHub 搜索可复用的 Agent

## API 端点

### Kimi API (实际使用 DeepSeek)
- `POST /api/kimi/generate-agent` - 生成 Agent
- `POST /api/kimi/decompose-task` - 分解任务
- `POST /api/kimi/execute` - 执行任务

### 搜索
- `POST /api/search` - 网页搜索

### PDF
- `POST /api/generate-pdf` - 生成 PDF 报告
- `GET /api/pdfs/:filename` - 获取 PDF 文件

### Sandbox
- `POST /api/sandbox/execute` - 沙箱执行代码
- `GET /api/sandbox/execution/:id` - 获取执行结果

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 当前用户

### 任务
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PATCH /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

## 开发命令

```bash
npm run dev          # 开发模式（前端 + 后端）
npm run dev:client   # 仅前端
npm run dev:server   # 仅后端
npm run build        # 生产构建
npm run lint         # 代码检查
```

## Python 工具脚本

### 搜索工具 (tools/search_tool.py)

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

### 诊断工具 (tools/diagnose.py)

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

### PPT 生成工具 (tools/ppt_generator.py)

```bash
# 安装依赖
pip install python-pptx

# 基本用法
python tools/ppt_generator.py --title "标题" --slides "内容1|内容2|内容3" --output output.pptx

# 使用 JSON 配置文件
python tools/ppt_generator.py --json slides.json --output output.pptx
```
