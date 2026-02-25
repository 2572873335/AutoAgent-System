/**
 * Image Generator Service - 支持多种图像生成 API
 * 优先级: Stability AI > DALL-E > 其他
 */

const fetch = require('node-fetch');
const fs = require('fs/promises');
const path = require('path');

class ImageGeneratorService {
  constructor() {
    // Stability AI (免费额度)
    this.stabilityApiKey = process.env.STABILITY_API_KEY || '';
    // OpenAI DALL-E (如果有)
    this.openAiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * 生成图像 - 智能选择可用的 API
   */
  async generateImage(prompt, options = {}) {
    const { size = '1024x1024', style = 'natural' } = options;

    // 优先使用 Stability AI
    if (this.stabilityApiKey) {
      const result = await this.generateWithStability(prompt, options);
      if (result.success) return result;
    }

    // 其次尝试 DALL-E
    if (this.openAiApiKey) {
      const result = await this.generateWithDalle(prompt, options);
      if (result.success) return result;
    }

    // 都没有配置
    return {
      success: false,
      error: 'No image generation API configured. Please set STABILITY_API_KEY or OPENAI_API_KEY in .env'
    };
  }

  /**
   * 使用 Stability AI 生成图像
   * 免费注册: https://platform.stability.ai/
   */
  async generateWithStability(prompt, options = {}) {
    const { size = '1024x1024', style = 'natural' } = options;

    // 映射尺寸
    const sizeMap = {
      '512x512': { width: 512, height: 512 },
      '768x768': { width: 768, height: 768 },
      '1024x1024': { width: 1024, height: 1024 },
      '1280x720': { width: 1280, height: 720 },
      '1920x1080': { width: 1920, height: 1080 }
    };

    const dimensions = sizeMap[size] || sizeMap['1024x1024'];

    // 构建 prompt
    let enhancedPrompt = prompt;
    if (style === 'pixar') {
      enhancedPrompt = `Pixar animation style: ${prompt}. 3D cartoon, disney pixar, colorful, beautiful lighting, high quality`;
    } else if (style === 'cinematic') {
      enhancedPrompt = `Cinematic: ${prompt}. Movie quality, dramatic lighting, film grain, professional photography`;
    } else if (style === 'anime') {
      enhancedPrompt = `Anime: ${prompt}. Japanese anime style, cel shaded, vibrant colors`;
    } else if (style === 'realistic') {
      enhancedPrompt = `Photorealistic: ${prompt}. Realistic, high detail, 8k quality`;
    }

    try {
      const response = await fetch('https://api.stability.ai/v2beta/image generation/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.stabilityApiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          negative_prompt: 'blurry, low quality, distorted, watermark, text',
          width: dimensions.width,
          height: dimensions.height,
          steps: 30,
          seed: Math.floor(Math.random() * 1000000),
          cfg_scale: 7,
          samples: 1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability AI error:', errorText);
        return { success: false, error: `Stability AI error: ${response.status}` };
      }

      const data = await response.json();

      // Stability AI 返回 base64 编码的图片
      const base64Image = data.artifacts?.[0]?.base64;
      if (!base64Image) {
        return { success: false, error: 'No image in Stability AI response' };
      }

      // 将 base64 转换为 data URL
      const imageUrl = `data:image/png;base64,${base64Image}`;

      return {
        success: true,
        imageUrl,
        provider: 'stability_ai'
      };
    } catch (error) {
      console.error('Stability AI exception:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 使用 DALL-E 生成图像
   */
  async generateWithDalle(prompt, options = {}) {
    const { size = '1024x1024', style = 'natural' } = options;

    // 映射尺寸
    const sizeMap = {
      '512x512': '512x512',
      '768x768': '768x768',
      '1024x1024': '1024x1024',
      '1280x720': '1024x1024', // DALL-E 不支持这个尺寸
      '1920x1080': '1024x1024'
    };

    const dalleSize = sizeMap[size] || '1024x1024';

    // 构建 prompt
    let enhancedPrompt = prompt;
    if (style === 'pixar') {
      enhancedPrompt = `Pixar animation style: ${prompt}. 3D cartoon, disney pixar, colorful`;
    } else if (style === 'cinematic') {
      enhancedPrompt = `Cinematic: ${prompt}. Movie quality, dramatic lighting`;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openAiApiKey}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          size: dalleSize,
          quality: 'standard',
          n: 1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DALL-E error:', errorText);
        return { success: false, error: `DALL-E error: ${response.status}` };
      }

      const data = await response.json();

      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) {
        return { success: false, error: 'No image in DALL-E response' };
      }

      return {
        success: true,
        imageUrl,
        provider: 'dall-e'
      };
    } catch (error) {
      console.error('DALL-E exception:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量生成图像
   */
  async generateImageBatch(prompts, options = {}) {
    const { concurrency = 3 } = options;

    const results = [];

    // 并发控制
    const limit = createPLimit(concurrency);

    const promises = prompts.map((prompt, index) =>
      limit(async () => {
        try {
          const result = await this.generateImage(prompt, options);
          return {
            index,
            prompt,
            success: result.success,
            url: result.imageUrl || null,
            error: result.error
          };
        } catch (error) {
          return {
            index,
            prompt,
            success: false,
            url: null,
            error: error.message
          };
        }
      })
    );

    const batchResults = await Promise.all(promises);
    batchResults.sort((a, b) => a.index - b.index);

    return {
      success: batchResults.some(r => r.success),
      images: batchResults,
      total: prompts.length,
      successful: batchResults.filter(r => r.success).length,
      failed: batchResults.filter(r => !r.success).length
    };
  }

  /**
   * 检查配置状态
   */
  getStatus() {
    return {
      stabilityAiConfigured: !!this.stabilityApiKey,
      openAiConfigured: !!this.openAiApiKey,
      available: !!(this.stabilityApiKey || this.openAiApiKey)
    };
  }
}

// p-limit 兼容实现
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

// 导出单例
const imageGeneratorService = new ImageGeneratorService();

module.exports = {
  ImageGeneratorService,
  imageGeneratorService
};
