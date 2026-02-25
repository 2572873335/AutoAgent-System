/**
 * DeepSeek Service - DeepSeek API 服务封装
 * 处理API调用、重试机制和错误处理
 */

const fetch = require('node-fetch');

const KIMI_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const KIMI_API_KEY = process.env.DEEPSEEK_API_KEY;

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 2000, // 2秒
  timeout: 60000 // 60秒
};

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DeepSeek 服务类
 */
class DeepSeekService {
  constructor() {
    this.apiUrl = KIMI_API_URL;
    this.apiKey = KIMI_API_KEY;
  }

  /**
   * 检查 API Key 是否配置
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * 发送聊天完成请求
   * @param {object} options - 请求选项
   * @param {Array} options.messages - 消息数组
   * @param {string} options.model - 模型名称 (默认 deepseek-chat)
   * @param {number} options.temperature - 温度 (默认 0.7)
   * @param {number} options.max_tokens - 最大token数 (默认 4000)
   * @param {Array} options.tools - 工具定义数组（可选）
   * @param {string} options.tool_choice - 工具选择策略 (可选)
   * @returns {Promise<object>} API响应
   */
  async chatCompletion(options) {
    if (!this.isConfigured()) {
      throw new Error('DEEPSEEK_API_KEY not configured. Please set it in .env file.');
    }

    const {
      messages,
      model = 'deepseek-chat',
      temperature = 0.7,
      max_tokens = 4000,
      tools,
      tool_choice
    } = options;

    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens
    };

    // 如果提供了工具定义，添加到请求
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      if (tool_choice) {
        requestBody.tool_choice = tool_choice;
      }
    }

    let lastError = null;

    // 重试循环
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        console.log(`[DeepSeek] API call attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，不再重试
        if (attempt === RETRY_CONFIG.maxRetries) {
          break;
        }

        // 判断是否应该重试
        const shouldRetry = this._shouldRetry(error);

        if (shouldRetry) {
          console.log(`[DeepSeek] Retrying after ${RETRY_CONFIG.retryDelay}ms...`);
          await delay(RETRY_CONFIG.retryDelay);
        } else {
          // 不应该重试的错误，直接抛出
          throw error;
        }
      }
    }

    // 所有重试都失败了
    console.error('[DeepSeek] All retry attempts failed');
    throw lastError || new Error('API request failed after all retries');
  }

  /**
   * 判断是否应该重试
   */
  _shouldRetry(error) {
    // 网络错误、超时错误应该重试
    if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // 服务器错误 (5xx) 应该重试
    if (error.message && error.message.includes('API error 5')) {
      return true;
    }

    // 速率限制 (429) 应该重试
    if (error.message && error.message.includes('API error 429')) {
      return true;
    }

    // 客户端错误 (4xx 除了 429) 不应该重试
    if (error.message && error.message.includes('API error 4') && !error.message.includes('429')) {
      return false;
    }

    // 默认重试
    return true;
  }

  /**
   * 简化的函数调用请求
   * 自动处理工具调用流程
   */
  async functionCall(options) {
    const {
      messages,
      tools,
      model = 'deepseek-chat',
      temperature = 0.7,
      max_tokens = 4000
    } = options;

    const response = await this.chatCompletion({
      messages,
      tools,
      tool_choice: 'auto',
      model,
      temperature,
      max_tokens
    });

    const message = response.choices[0]?.message;

    return {
      content: message?.content || null,
      toolCalls: message?.tool_calls || [],
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
      raw: response
    };
  }

  /**
   * 发送简单消息
   */
  async simpleChat(message, options = {}) {
    const messages = [{ role: 'user', content: message }];

    if (options.system) {
      messages.unshift({ role: 'system', content: options.system });
    }

    const response = await this.chatCompletion({
      messages,
      model: options.model || 'deepseek-chat',
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 4000
    });

    return response.choices[0]?.message?.content || '';
  }
}

// 导出单例
const deepseekService = new DeepSeekService();

module.exports = {
  DeepSeekService,
  deepseekService
};
