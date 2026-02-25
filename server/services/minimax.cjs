/**
 * MiniMax Service - 提供 MiniMax API 封装（Coding Plan API）
 */

const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

class MiniMaxService {
  constructor() {
    this.apiKey = process.env.MINIMAX_API_KEY || '';
    this.baseUrl = 'https://api.minimax.chat/v1';
    this.groupId = process.env.MINIMAX_GROUP_ID || '';
    // Coding Plan API URL
    this.codingPlanUrl = process.env.MINIMAX_CODING_PLAN_URL || '';
  }

  /**
   * 生成图像 - Coding Plan 版本
   * 注意: Coding Plan 主要用于文本对话，图像生成可能不支持
   * @param {string} prompt - 图像描述
   * @param {object} options - 选项
   * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
   */
  async generateImage(prompt, options = {}) {
    const { size = '1024x1024', style = 'natural' } = options;

    if (!this.apiKey) {
      return { success: false, error: 'MINIMAX_API_KEY not configured' };
    }

    // Coding Plan 不支持图像生成，返回提示信息
    return {
      success: false,
      error: 'Coding Plan API does not support image generation. Please use MiniMax standard API with GROUP_ID.'
    };
  }

  /**
   * 批量生成图像
   */
  async generateImageBatch(prompts, options = {}) {
    return {
      success: false,
      error: 'Coding Plan API does not support image generation. Please use MiniMax standard API with GROUP_ID.'
    };
  }

  /**
   * 文本生成 - 使用 Coding Plan API
   */
  async chatCompletion(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('MINIMAX_API_KEY not configured');
    }

    if (!this.codingPlanUrl) {
      throw new Error('MINIMAX_CODING_PLAN_URL not configured');
    }

    const { temperature = 0.7, max_tokens = 4000 } = options;

    try {
      // Coding Plan API 格式
      const response = await fetch(this.codingPlanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          bot_setting: [
            {
              bot_name: 'assistant',
              content: 'You are a helpful AI assistant.'
            }
          ],
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            sender_name: msg.role === 'user' ? 'user' : 'assistant',
            sender_type: msg.role === 'user' ? 'USER' : 'BOT'
          })),
          reply_constraints: {
            type: 'text',
            sender_type: 'BOT',
            sender_name: 'assistant'
          },
          temperature,
          max_tokens
        })
      });

      const data = await response.json();

      // 检查错误
      if (data.base_resp && data.base_resp.status_code !== 0) {
        throw new Error(data.base_resp.status_msg || 'API error');
      }

      return data;
    } catch (error) {
      console.error('MiniMax chat completion error:', error);
      throw error;
    }
  }

  /**
   * 使用 Function Calling
   */
  async functionCall(options) {
    return this.chatCompletion(options.messages, {
      temperature: options.temperature,
      max_tokens: options.max_tokens
    });
  }

  /**
   * 检查配置状态
   */
  getStatus() {
    return {
      configured: !!this.apiKey,
      hasApiKey: !!this.apiKey,
      hasGroupId: !!this.groupId,
      hasCodingPlanUrl: !!this.codingPlanUrl,
      mode: this.codingPlanUrl ? 'coding_plan' : (this.groupId ? 'standard' : 'unconfigured')
    };
  }
}

// 导出单例
const miniMaxService = new MiniMaxService();

module.exports = {
  MiniMaxService,
  miniMaxService
};
