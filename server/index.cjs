const PDFDocument = require('pdfkit');
const cron = require('node-cron');

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');

const execAsync = util.promisify(exec);

// ==================== NEW TOOL SYSTEM IMPORTS ====================
const { TOOL_DEFINITIONS, toolExecutor } = require('./tools/registry.cjs');
const { deepseekService } = require('./services/deepseek.cjs');
const { generateTaskId, isValidTaskId } = require('./utils/id.cjs');

// p-limit for concurrency control - using fallback implementation
// Note: p-limit is ESM only, we use a simple CJS-compatible implementation
function createPLimit(concurrency) {
  const queue = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      run(fn).then(resolve).catch(reject);
    }
  };

  const run = async (fn) => {
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };

  const limit = (fn) => {
    return new Promise((resolve, reject) => {
      if (activeCount < concurrency) {
        run(fn).then(resolve).catch(reject);
      } else {
        queue.push({ fn, resolve, reject });
      }
    });
  };

  return limit;
}

// Concurrency limiter (max 5 concurrent tasks)
const limit = createPLimit(5);

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0 && !key.startsWith('#')) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
}

const PORT = process.env.PORT || 3001;
const CODE_DIR = path.join(__dirname, 'code-sandbox');

if (!fs.existsSync(CODE_DIR)) {
  fs.mkdirSync(CODE_DIR, { recursive: true });
}

const KIMI_API_KEY = process.env.DEEPSEEK_API_KEY;
const KIMI_API_URL = 'https://api.deepseek.com/v1/chat/completions';

if (!KIMI_API_KEY) {
  console.error('Warning: DEEPSEEK_API_KEY not set. API calls will fail.');
  console.error('Please create a .env file with DEEPSEEK_API_KEY=your-key');
}

// ==================== WEB SEARCH FUNCTIONALITY ====================

// Web search using Bing (simplified parsing)
async function searchWeb(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    // Use Bing search
    const url = `https://www.bing.com/search?q=${encodedQuery}&count=10&form=QBLH`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();

    // Simplified parsing - extract title and url from anchor tags
    const results = [];

    // Match pattern: <a ... href="url">title</a>
    const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    const seenUrls = new Set();

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      let title = match[2].replace(/<[^>]+>/g, '').trim();

      // Filter out navigation links and short titles
      if (title.length > 5 &&
          !url.includes('bing.com') &&
          !url.includes('microsoft.com') &&
          !seenUrls.has(url) &&
          results.length < 10) {

        // Try to get description from nearby text
        let snippet = '';
        const aroundMatch = html.substring(Math.max(0, match.index - 200), match.index).match(/<p[^>]*>([^<]+)<\/p>/);
        if (aroundMatch) {
          snippet = aroundMatch[1].replace(/<[^>]+>/g, '').substring(0, 150);
        }

        results.push({
          title: title,
          url: url,
          snippet: snippet || 'Click to view'
        });
        seenUrls.add(url);
      }
    }

    return {
      success: true,
      query,
      results,
      count: results.length
    };
  } catch (error) {
    return {
      success: false,
      query,
      error: error.message,
      results: []
    };
  }
}

const users = new Map();
const tasks = new Map();
const codeExecutions = new Map();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users.has(username)) return res.status(400).json({ error: 'Username already exists' });
  const user = { username, createdAt: Date.now() };
  users.set(username, { ...user, password });
  res.json({ success: true, user: { username, createdAt: user.createdAt } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomUUID();
  user.token = token;
  res.json({ success: true, token, user: { username, createdAt: user.createdAt } });
});

app.post('/api/tasks', (req, res) => {
  const { description } = req.body;
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const task = { id: taskId, description, status: 'pending', createdAt: Date.now() };
  tasks.set(taskId, task);
  res.json({ success: true, taskId });
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: Array.from(tasks.values()) });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (task) res.json(task);
  else res.status(404).json({ error: 'Task not found' });
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  if (tasks.has(id)) {
    tasks.set(id, { ...tasks.get(id), ...req.body });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  if (tasks.delete(req.params.id)) res.json({ success: true });
  else res.status(404).json({ error: 'Task not found' });
});

app.post('/api/kimi/decompose-task', async (req, res) => {
  logDeprecation('/api/kimi/decompose-task');
  try {
    const { taskDescription } = req.body;
    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an AI task planner. Respond ONLY with JSON array: [{"id": "subtask_1", "description": "...", "dependencies": []}]' },
          { role: 'user', content: `Task: ${taskDescription}\nCreate subtasks:` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    let subtasks;
    try { subtasks = JSON.parse(content); } 
    catch { subtasks = content.split('\n').filter(l => l.trim()).map((l, i) => ({ id: `subtask_${i+1}`, description: l.replace(/^\d+\.\s*/, ''), dependencies: [] })); }
    res.json({ success: true, subtasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kimi/generate-agent', async (req, res) => {
  logDeprecation('/api/kimi/generate-agent');
  try {
    const { taskDescription, agentType, requirements } = req.body;
    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Generate ONLY plain JavaScript code with module.exports. No TypeScript.' },
          { role: 'user', content: `Create Agent for: ${taskDescription}, Type: ${agentType}` }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${await response.text()}`);
    const data = await response.json();
    const generatedCode = data.choices[0]?.message?.content || '';
    const codeMatch = generatedCode.match(/```(?:javascript|js)?\n?([\s\S]*?)```/) || [null, generatedCode];
    res.json({ success: true, code: codeMatch[1] || generatedCode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEB SEARCH API ====================

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    console.log(`Searching web for: ${query}`);
    const searchResult = await searchWeb(query);

    res.json(searchResult);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TASK EXECUTION ====================

app.post('/api/kimi/execute', async (req, res) => {
  logDeprecation('/api/kimi/execute');
  try {
    const { agentCode, subTaskDescription, input, context } = req.body;

    // Detect if this is a research task that needs web search
    const isResearchTask = /research|search|find|latest|trends|news|current|today|202[4-9]|最新|趋势|搜索|研究/i.test(subTaskDescription);

    // For research tasks, first search the web then use LLM to summarize
    if (isResearchTask) {
      console.log(`Research task detected: ${subTaskDescription}`);

      // Step 1: Search the web
      const searchResult = await searchWeb(subTaskDescription);

      if (searchResult.success && searchResult.results.length > 0) {
        // Step 2: Use LLM to summarize search results
        const searchSummary = searchResult.results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
          .join('\n\n');

        const llmResponse = await fetch(KIMI_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a research assistant. Based on the web search results provided, summarize the findings in a clear, comprehensive manner. Include specific details and cite sources when possible.'
              },
              {
                role: 'user',
                content: `Task: ${subTaskDescription}\n\nWeb Search Results:\n${searchSummary}\n\nPlease provide a comprehensive summary of these findings.`
              }
            ],
            temperature: 0.5,
            max_tokens: 3000,
          }),
        });

        if (!llmResponse.ok) throw new Error(`LLM error: ${await llmResponse.text()}`);

        const llmData = await llmResponse.json();
        const summary = llmData.choices[0]?.message?.content || 'Failed to generate summary';

        const result = {
          result: summary,
          logs: [
            `Search completed: ${searchResult.count} results found`,
            'Summary generated using AI'
          ],
          sources: searchResult.results.slice(0, 5).map(r => r.url)
        };

        res.json({ success: true, result });
        return;
      }
    }

    // Non-research tasks or search failed: use standard DeepSeek execution
    console.log(`Using DeepSeek API for task: ${subTaskDescription}`);

    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `You are an AI agent executing a task.

CONTEXT:
- Task Description: ${context?.task || 'General task'}
- Current Step: ${subTaskDescription}
- Input: ${JSON.stringify(input)}

INSTRUCTIONS:
1. Execute the task described in "Current Step"
2. If it's research, search the web and summarize findings
3. If it's writing, generate the content
4. If it's PDF generation, create the PDF content
5. Return ONLY valid JSON: { "result": "your actual result here", "logs": ["log1", "log2"] }

Be specific and detailed in your result. Don't just say "completed" - provide actual content.` },
          { role: 'user', content: `Execute this task now and provide the result.` }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    let result;
    try { result = JSON.parse(content); }
    catch { result = { result: content, logs: ['Executed successfully'] }; }
    res.json({ success: true, result });
  } catch (error) {
    console.error('Execute API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint - kept for compatibility
app.post('/api/sandbox/execute-llm', async (req, res) => {
  try {
    const { agentCode, subTaskDescription, input, context } = req.body;
    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIMI_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Execute the agent code and return JSON: { "result": "...", "logs": ["..."] }' },
          { role: 'user', content: `Agent:\n${agentCode}\n\nTask: ${subTaskDescription}\nInput: ${JSON.stringify(input)}` }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });
    if (!response.ok) throw new Error(`API error: ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    let result;
    try { result = JSON.parse(content); }
    catch { result = { result: content, logs: ['Executed'] }; }
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sandbox/execute', async (req, res) => {
  console.log('DIRECT EXECUTE called with:', Object.keys(req.body));
  try {
    const { code, timeout = 30000 } = req.body;
    const executionId = crypto.randomUUID();
    const filePath = path.join(CODE_DIR, `exec_${executionId}.cjs`);
    fs.writeFileSync(filePath, code);
    const startTime = Date.now();
    try {
      const { stdout, stderr } = await execAsync(`node "${filePath}"`, { timeout, maxBuffer: 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      const executionTime = Date.now() - startTime;
      fs.unlinkSync(filePath);
      res.json({ success: true, executionId, output: stdout, error: stderr, executionTime });
    } catch (execError) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: false, executionId, output: execError.stdout || '', error: execError.stderr || execError.message, executionTime: Date.now() - startTime });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sandbox/execution/:id', (req, res) => {
  const execution = codeExecutions.get(req.params.id);
  if (execution) res.json(execution);
  else res.status(404).json({ error: 'Execution not found' });
});

app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { content, filename = 'report.pdf' } = req.body;
    const pdfDir = path.join(__dirname, 'generated-pdfs');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const filePath = path.join(pdfDir, filename);
    
    console.log('Generating PDF with content:', content ? content.substring(0, 100) : 'empty');
    
    // Generate actual PDF using PDFKit
    const doc = new PDFDocument();
    
    // Pipe to file directly (not stream)
    doc.pipe(fs.createWriteStream(filePath));
    
    // Add title
    doc.fontSize(20).text('Task Execution Report', { align: 'center' });
    doc.moveDown();
    
    // Parse content and add to PDF
    let textContent = '';
    if (typeof content === 'string') {
      textContent = content;
      // Remove markdown headers
      textContent = textContent.replace(/#{1,6}\s/g, '');
      // Remove code blocks
      textContent = textContent.replace(/```json|```/g, '');
      // Remove JSON special chars
      textContent = textContent.replace(/[{}"]/g, '');
      // Clean up escape sequences
      textContent = textContent.replace(/\\n/g, '\n');
    } else if (content && typeof content === 'object') {
      textContent = JSON.stringify(content, null, 2);
    }
    
    doc.fontSize(12).text(textContent || 'No content');
    
    doc.end();
    
    // Wait a bit for the file to be written
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('PDF generated successfully');
    res.json({ success: true, filepath: filePath, url: `/api/pdfs/${filename}` });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/pdfs/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'generated-pdfs', req.params.filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ error: 'File not found' });
});

// ==================== NEW TOOL SYSTEM API ====================

/**
 * POST /api/agent/execute-stream
 * SSE流式执行任务，支持工具调用
 */
app.post('/api/agent/execute-stream', async (req, res) => {
  const { task } = req.body;

  if (!task) {
    return res.status(400).json({ error: 'Task description is required' });
  }

  // 生成任务ID
  const taskId = generateTaskId();
  const workspace = path.join(__dirname, '..', 'temp', taskId);

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 发送事件的辅助函数
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 发送初始事件
  sendEvent('init', { taskId, status: 'started' });

  try {
    // 确保工作空间存在
    await fsPromises.mkdir(workspace, { recursive: true });

    // === 第一阶段：调用 DeepSeek，传入工具定义 ===
    sendEvent('thought', {
      status: 'planning',
      message: '分析任务并规划工具调用...'
    });

    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant with access to tools. Analyze the user's request and determine which tools to use.

When you need to use a tool, respond with a tool call.
When you don't need any tools, provide a direct response.

Available tools:
1. web_search - Search the web for current information
2. generate_ppt - Create PowerPoint presentations
3. read_file - Read files from the workspace

Always explain your reasoning before making tool calls.`
      },
      {
        role: 'user',
        content: task
      }
    ];

    const initialResponse = await deepseekService.functionCall({
      messages,
      tools: TOOL_DEFINITIONS,
      temperature: 0.7,
      max_tokens: 4000
    });

    // 如果模型没有调用工具，直接返回结果
    if (initialResponse.toolCalls.length === 0) {
      sendEvent('thought', {
        status: 'completed',
        message: '无需工具调用，直接生成回答'
      });

      sendEvent('final', {
        status: 'success',
        answer: initialResponse.content || 'Task completed',
        taskId,
        downloads: []
      });

      res.end();
      return;
    }

    // === 第二阶段：执行工具调用 ===
    sendEvent('thought', {
      status: 'executing',
      message: `计划执行 ${initialResponse.toolCalls.length} 个工具调用`
    });

    const toolResults = [];
    const downloads = [];

    // 并行执行所有工具调用
    const toolPromises = initialResponse.toolCalls.map(async (toolCall) => {
      const toolName = toolCall.function?.name;
      const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
      const toolCallId = toolCall.id;

      // 发送工具开始事件
      sendEvent('tool_start', {
        tool: toolName,
        args: toolArgs,
        callId: toolCallId
      });

      try {
        // 使用限制器执行工具
        const result = await limit(() => toolExecutor.execute(toolName, toolArgs, taskId));

        if (result.success) {
          // 检查是否有生成的文件
          if (result.result?.download_url) {
            downloads.push({
              name: result.result.filename,
              url: result.result.download_url,
              size: result.result.size
            });
          }

          toolResults.push({
            tool_call_id: toolCallId,
            role: 'tool',
            name: toolName,
            content: JSON.stringify(result.result)
          });

          sendEvent('tool_result', {
            tool: toolName,
            callId: toolCallId,
            status: 'success',
            result: result.result
          });
        } else {
          toolResults.push({
            tool_call_id: toolCallId,
            role: 'tool',
            name: toolName,
            content: `Error: ${result.error}`
          });

          sendEvent('tool_result', {
            tool: toolName,
            callId: toolCallId,
            status: 'error',
            error: result.error
          });
        }
      } catch (error) {
        toolResults.push({
          tool_call_id: toolCallId,
          role: 'tool',
          name: toolName,
          content: `Error: ${error.message}`
        });

        sendEvent('tool_result', {
          tool: toolName,
          callId: toolCallId,
          status: 'error',
          error: error.message
        });
      }
    });

    await Promise.all(toolPromises);

    // === 第三阶段：将结果反馈给 LLM 生成最终回答 ===
    sendEvent('thought', {
      status: 'synthesizing',
      message: '整合工具执行结果，生成最终回答...'
    });

    const finalMessages = [
      ...messages,
      {
        role: 'assistant',
        content: initialResponse.content || '',
        tool_calls: initialResponse.toolCalls
      },
      ...toolResults
    ];

    const finalResponse = await deepseekService.chatCompletion({
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 4000
    });

    const finalAnswer = finalResponse.choices[0]?.message?.content || 'Task completed';

    sendEvent('final', {
      status: 'success',
      answer: finalAnswer,
      taskId,
      downloads,
      usage: finalResponse.usage
    });

  } catch (error) {
    console.error('Execute-stream error:', error);

    sendEvent('error', {
      status: 'error',
      message: error.message,
      taskId
    });
  } finally {
    res.end();
  }
});

/**
 * GET /api/tools/list
 * 获取可用工具列表
 */
app.get('/api/tools/list', (req, res) => {
  res.json({
    success: true,
    tools: TOOL_DEFINITIONS.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }))
  });
});

/**
 * GET /api/files/:taskId/:filename
 * 安全下载文件
 */
app.get('/api/files/:taskId/:filename', async (req, res) => {
  const { taskId, filename } = req.params;

  // 验证 taskId 格式
  const validTaskId = /^[a-zA-Z0-9_-]+$/.test(taskId);
  if (!validTaskId) {
    return res.status(403).json({ error: 'Invalid task ID format' });
  }

  // 验证 filename 格式
  const validFilename = /^[a-zA-Z0-9-_.]+\.[a-zA-Z0-9]+$/.test(filename);
  if (!validFilename) {
    return res.status(403).json({ error: 'Invalid filename format' });
  }

  // 防止双扩展名攻击
  const parts = filename.split('.');
  if (parts.length !== 2) {
    return res.status(403).json({ error: 'Invalid filename' });
  }

  try {
    const filePath = path.join(__dirname, '..', 'temp', taskId, filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(path.join(__dirname, '..', 'temp', taskId));

    // 确保路径在工作空间内
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 检查文件是否存在
    const stats = await fsPromises.stat(filePath);

    if (!stats.isFile()) {
      return res.status(404).json({ error: 'Not a file' });
    }

    // 文件大小检查 (50MB)
    if (stats.size > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large' });
    }

    // 设置下载头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('File download error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TEMP DIRECTORY CLEANUP ====================

/**
 * 清理临时目录
 * 删除超过24小时的目录
 */
async function cleanupTempDirectory() {
  const tempDir = path.join(__dirname, '..', 'temp');

  try {
    const entries = await fsPromises.readdir(tempDir, { withFileTypes: true });
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    let cleaned = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(tempDir, entry.name);
      const stats = await fsPromises.stat(entryPath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        await fsPromises.rm(entryPath, { recursive: true, force: true });
        cleaned++;
        console.log(`[Cleanup] Removed old directory: ${entry.name}`);
      }
    }

    if (cleaned > 0) {
      console.log(`[Cleanup] Cleaned ${cleaned} old directories`);
    }
  } catch (error) {
    console.error('[Cleanup] Error:', error.message);
  }
}

// 启动定时清理任务（每小时执行一次）
cron.schedule('0 * * * *', () => {
  console.log('[Cron] Starting scheduled cleanup...');
  cleanupTempDirectory();
});

// 启动时执行一次清理
cleanupTempDirectory();

// ==================== DEPRECATION WARNINGS ====================

// 在旧端点添加弃用警告日志
function logDeprecation(route) {
  console.warn(`[Deprecated] ${route} is deprecated. Consider migrating to the new tool system.`);
}

// ==================== SERVER START ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`New tool system available at:`);
  console.log(`  - POST /api/agent/execute-stream (SSE streaming)`);
  console.log(`  - GET  /api/tools/list`);
  console.log(`  - GET  /api/files/:taskId/:filename`);
});
