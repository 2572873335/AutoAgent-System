/**
 * Tool Registry - 工具注册表
 * 管理所有可用工具的注册和执行
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const { access, constants } = require('fs/promises');
const { miniMaxService } = require('../services/minimax.cjs');
const { imageGeneratorService } = require('../services/imageGenerator.cjs');

// 工具定义（用于 DeepSeek Function Calling）
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information using DuckDuckGo. Use this when you need to find current information, latest news, or any factual data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query (max 200 characters)'
          },
          num_results: {
            type: 'integer',
            description: 'Number of results to return (default 10, max 20)',
            default: 10
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_ppt',
      description: 'Generate a PowerPoint presentation (.pptx) with slides. Use this when the user requests a presentation or slides.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The presentation title (max 100 characters)'
          },
          slides: {
            type: 'array',
            description: 'Array of slide data objects',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['title', 'content', 'summary', 'closing'],
                  description: 'Slide type'
                },
                title: {
                  type: 'string',
                  description: 'Slide title'
                },
                content: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Content lines for content slides'
                },
                points: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Bullet points for summary slides'
                },
                subtitle: {
                  type: 'string',
                  description: 'Subtitle for title or closing slides'
                }
              }
            }
          },
          output_filename: {
            type: 'string',
            description: 'Output filename (e.g., presentation.pptx, max 100 characters)'
          }
        },
        required: ['title', 'slides', 'output_filename']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate a single image using MiniMax AI. Use this when the user requests to create images, storyboards, or video frames. Supports Pixar style, cinematic style, and more.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The image description/prompt (max 500 characters). Be descriptive and include details about style, lighting, and composition.'
          },
          size: {
            type: 'string',
            enum: ['512x512', '768x768', '1024x1024', '1280x720', '1920x1080'],
            description: 'Image size (default 1024x1024)',
            default: '1024x1024'
          },
          style: {
            type: 'string',
            enum: ['natural', 'pixar', 'cinematic', 'anime', 'realistic'],
            description: 'Image style (default pixar for storyboards)',
            default: 'pixar'
          }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image_batch',
      description: 'Generate multiple images in batch using MiniMax AI. Use this when the user requests multiple images, such as storyboard frames or video scenes. This is more efficient than calling generate_image multiple times.',
      parameters: {
        type: 'object',
        properties: {
          prompts: {
            type: 'array',
            description: 'Array of image prompts (max 20 prompts)',
            items: {
              type: 'string',
              description: 'Image description/prompt'
            },
            maxItems: 20
          },
          size: {
            type: 'string',
            enum: ['512x512', '768x768', '1024x1024', '1280x720', '1920x1080'],
            description: 'Image size (default 1024x1024)',
            default: '1024x1024'
          },
          style: {
            type: 'string',
            enum: ['natural', 'pixar', 'cinematic', 'anime', 'realistic'],
            description: 'Image style (default pixar)',
            default: 'pixar'
          }
        },
        required: ['prompts']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file in the workspace. Use this when you need to access or analyze an existing file.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The filename to read (max 100 characters, alphanumeric with one dot)'
          }
        },
        required: ['filename']
      }
    }
  }
];

/**
 * 工具执行器类
 */
class ToolExecutor {
  constructor() {
    this.executions = new Map();
  }

  /**
   * 执行工具
   * @param {string} toolName - 工具名称
   * @param {object} args - 工具参数
   * @param {string} taskId - 任务ID（用于工作空间隔离）
   * @returns {Promise<{success: boolean, result: any, error?: string}>}
   */
  async execute(toolName, args, taskId) {
    const executionId = `${taskId}_${toolName}_${Date.now()}`;
    const startTime = Date.now();

    try {
      // 验证参数
      const validationError = this._validateArgs(toolName, args);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // 创建超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout (60s)')), 60000);
      });

      let result;
      const workspace = path.join(process.cwd(), 'temp', taskId);

      // 确保工作空间存在
      try {
        await fs.mkdir(workspace, { recursive: true });
      } catch (err) {
        console.error(`Failed to create workspace ${workspace}:`, err);
      }

      // 根据工具类型执行
      switch (toolName) {
        case 'web_search':
          result = await Promise.race([
            this._webSearch(args),
            timeoutPromise
          ]);
          break;

        case 'generate_ppt':
          result = await Promise.race([
            this._generatePPT(args, workspace),
            timeoutPromise
          ]);
          break;

        case 'generate_image':
          result = await Promise.race([
            this._generateImage(args),
            timeoutPromise
          ]);
          break;

        case 'generate_image_batch':
          result = await Promise.race([
            this._generateImageBatch(args),
            timeoutPromise
          ]);
          break;

        case 'read_file':
          result = await Promise.race([
            this._readFile(args, workspace),
            timeoutPromise
          ]);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      // 记录执行
      this.executions.set(executionId, {
        id: executionId,
        tool: toolName,
        args,
        taskId,
        startTime,
        endTime: Date.now(),
        success: true,
        result
      });

      return { success: true, result };

    } catch (error) {
      // 记录失败
      this.executions.set(executionId, {
        id: executionId,
        tool: toolName,
        args,
        taskId,
        startTime,
        endTime: Date.now(),
        success: false,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * 验证参数
   */
  _validateArgs(toolName, args) {
    // 查询长度限制
    if (args.query && args.query.length > 200) {
      return 'Query exceeds maximum length of 200 characters';
    }

    // 图片生成提示词长度限制
    if (args.prompt && args.prompt.length > 500) {
      return 'Prompt exceeds maximum length of 500 characters';
    }

    // 批量生成提示词限制
    if (args.prompts && args.prompts.length > 20) {
      return 'Maximum 20 prompts allowed in batch';
    }

    if (args.prompts && args.prompts.some(p => p && p.length > 500)) {
      return 'Each prompt must be under 500 characters';
    }

    // 文件名长度限制
    if (args.filename && args.filename.length > 100) {
      return 'Filename exceeds maximum length of 100 characters';
    }

    if (args.output_filename && args.output_filename.length > 100) {
      return 'Output filename exceeds maximum length of 100 characters';
    }

    // 文件名格式验证（防止路径遍历）
    if (args.filename) {
      const validName = /^[a-zA-Z0-9-_.]+\.[a-zA-Z0-9]+$/.test(args.filename);
      if (!validName) {
        return 'Invalid filename format';
      }
      // 防止双扩展名攻击
      const parts = args.filename.split('.');
      if (parts.length !== 2) {
        return 'Filename must have exactly one extension';
      }
    }

    if (args.output_filename) {
      const validName = /^[a-zA-Z0-9-_.]+\.[a-zA-Z0-9]+$/.test(args.output_filename);
      if (!validName) {
        return 'Invalid output filename format';
      }
    }

    return null;
  }

  /**
   * Web搜索 - 调用 Python search_tool.py
   */
  async _webSearch(args) {
    const { query, num_results = 10 } = args;
    const maxResults = Math.min(num_results, 20);

    return new Promise((resolve, reject) => {
      // Use __dirname to get the correct path relative to this file
      const scriptPath = path.join(__dirname, '..', '..', 'tools', 'search_tool.py');
      // Use shell: true and properly escape the query
      const escapedQuery = query.replace(/"/g, '\\"');
      const command = `python "${scriptPath}" "${escapedQuery}" -n ${maxResults} --json`;

      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error && !stdout) {
          console.error('Search error:', error);
          reject(new Error(`Search failed: ${error.message}`));
          return;
        }

        try {
          // 解析JSON输出
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));

          if (jsonLine) {
            const results = JSON.parse(jsonLine);
            resolve({
              query,
              count: results.length,
              results: results
            });
          } else {
            resolve({
              query,
              count: 0,
              results: [],
              note: 'No results found'
            });
          }
        } catch (parseErr) {
          console.error('Failed to parse search results:', parseErr);
          // 返回原始输出
          resolve({
            query,
            count: 0,
            results: [],
            raw: stdout
          });
        }
      });
    });
  }

  /**
   * 生成PPT - 调用 Python ppt_generator.py
   */
  async _generatePPT(args, workspace) {
    const { title, slides, output_filename } = args;

    // 构建JSON数据
    const slidesData = slides.map(slide => {
      switch (slide.type) {
        case 'title':
          return {
            type: 'title',
            title: slide.title || title,
            subtitle: slide.subtitle || ''
          };
        case 'content':
          return {
            type: 'content',
            title: slide.title || 'Content',
            content: slide.content || []
          };
        case 'summary':
          return {
            type: 'summary',
            title: slide.title || 'Summary',
            points: slide.points || []
          };
        case 'closing':
          return {
            type: 'closing',
            title: slide.title || '感谢聆听',
            subtitle: slide.subtitle || ''
          };
        default:
          return slide;
      }
    });

    // 如果没有title slide，添加一个
    if (!slidesData.find(s => s.type === 'title')) {
      slidesData.unshift({
        type: 'title',
        title: title,
        subtitle: ''
      });
    }

    // 写入JSON配置文件
    const jsonPath = path.join(workspace, 'slides_config.json');
    await fs.writeFile(jsonPath, JSON.stringify(slidesData, null, 2), 'utf-8');

    const outputPath = path.join(workspace, output_filename);

    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'tools', 'ppt_generator.py');
      const command = `python "${scriptPath}" --json "${jsonPath}" --output "${outputPath}"`;

      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('PPT generation error:', error);
          reject(new Error(`PPT generation failed: ${error.message}`));
          return;
        }

        if (stderr && stderr.includes('ERROR')) {
          console.error('PPT stderr:', stderr);
          reject(new Error(`PPT generation error: ${stderr}`));
          return;
        }

        resolve({
          filename: output_filename,
          filepath: outputPath,
          slides_count: slidesData.length,
          download_url: `/api/files/${path.basename(workspace)}/${output_filename}`
        });
      });
    });
  }

  /**
   * 生成单张图片 - 使用 ImageGeneratorService (支持 Stability AI / DALL-E)
   */
  async _generateImage(args) {
    const { prompt, size = '1024x1024', style = 'pixar' } = args;

    console.log(`[ImageGen] Generating image: ${prompt.substring(0, 50)}...`);

    const result = await imageGeneratorService.generateImage(prompt, { size, style });

    if (result.success) {
      return {
        success: true,
        prompt,
        size,
        style,
        image_url: result.imageUrl,
        provider: result.provider,
        message: `Image generated successfully (${result.provider})`
      };
    } else {
      throw new Error(result.error || 'Image generation failed');
    }
  }

  /**
   * 批量生成图片 - 使用 ImageGeneratorService
   */
  async _generateImageBatch(args) {
    const { prompts, size = '1024x1024', style = 'pixar' } = args;

    console.log(`[ImageGen] Generating batch of ${prompts.length} images`);

    const result = await imageGeneratorService.generateImageBatch(prompts, { size, style });

    if (result.success || result.successful > 0) {
      return {
        success: true,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        images: result.images.map(img => ({
          index: img.index,
          success: img.success,
          image_url: img.url,
          prompt: img.prompt?.substring(0, 100)
        })),
        message: `Generated ${result.successful}/${result.total} images successfully`
      };
    } else {
      throw new Error('Batch image generation failed');
    }
  }

  /**
   * 读取文件 - 安全工作空间内的文件
   */
  async _readFile(args, workspace) {
    const { filename } = args;

    // 安全路径组合
    const safeName = path.basename(filename);
    const filePath = path.join(workspace, safeName);

    // 验证路径在工作空间内
    const resolvedPath = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(workspace);

    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error('Access denied: file outside workspace');
    }

    try {
      // 检查文件是否存在且可读
      await access(filePath, constants.R_OK);

      // 读取文件
      const content = await fs.readFile(filePath, 'utf-8');

      // 文件大小检查（50MB限制）
      const stats = await fs.stat(filePath);
      const sizeMB = stats.size / (1024 * 1024);

      if (stats.size > 50 * 1024 * 1024) {
        return {
          filename,
          size: `${sizeMB.toFixed(2)} MB`,
          content: '[File too large to display]',
          truncated: true
        };
      }

      // 如果是二进制文件，返回基本信息
      if (filename.endsWith('.pptx') || filename.endsWith('.pdf')) {
        return {
          filename,
          size: `${sizeMB.toFixed(2)} MB`,
          type: 'binary',
          note: 'Binary file - use download link to view',
          download_url: `/api/files/${path.basename(workspace)}/${filename}`
        };
      }

      return {
        filename,
        size: `${sizeMB.toFixed(2)} MB`,
        content
      };

    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`File not found: ${filename}`);
      }
      if (err.code === 'EACCES') {
        throw new Error(`Permission denied: ${filename}`);
      }
      throw err;
    }
  }

  /**
   * 获取执行历史
   */
  getExecutions(taskId) {
    if (!taskId) {
      return Array.from(this.executions.values());
    }
    return Array.from(this.executions.values()).filter(e => e.taskId === taskId);
  }

  /**
   * 清理任务执行记录
   */
  clearExecutions(taskId) {
    if (taskId) {
      for (const [key, value] of this.executions.entries()) {
        if (value.taskId === taskId) {
          this.executions.delete(key);
        }
      }
    } else {
      this.executions.clear();
    }
  }
}

// 导出单例
const toolExecutor = new ToolExecutor();

module.exports = {
  TOOL_DEFINITIONS,
  ToolExecutor,
  toolExecutor
};
