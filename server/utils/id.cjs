/**
 * ID Generator - 任务ID生成器
 * 生成全局唯一的任务标识符
 */

/**
 * 生成任务ID
 * 格式: task_{timestamp}_{random}
 * 示例: task_1679500000000_a1b2c3d4
 *
 * @returns {string} 任务ID
 */
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `task_${timestamp}_${random}`;
}

/**
 * 生成执行步骤ID
 * 格式: step_{timestamp}_{random}
 *
 * @returns {string} 步骤ID
 */
function generateStepId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `step_${timestamp}_${random}`;
}

/**
 * 生成工具调用ID
 * 格式: tool_{timestamp}_{random}
 *
 * @returns {string} 工具调用ID
 */
function generateToolCallId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `tool_${timestamp}_${random}`;
}

/**
 * 验证任务ID格式
 * 只允许字母、数字、下划线和短横线
 *
 * @param {string} taskId - 要验证的任务ID
 * @returns {boolean} 是否有效
 */
function isValidTaskId(taskId) {
  if (typeof taskId !== 'string') return false;

  // 格式: task_{timestamp}_{random}
  const pattern = /^task_[a-zA-Z0-9_-]+$/;
  return pattern.test(taskId);
}

/**
 * 安全地清理任务ID
 * 移除任何潜在的危险字符
 *
 * @param {string} taskId - 原始任务ID
 * @returns {string|null} 清理后的任务ID，如果无效则返回null
 */
function sanitizeTaskId(taskId) {
  if (typeof taskId !== 'string') return null;

  // 只允许字母、数字、下划线和短横线
  const sanitized = taskId.replace(/[^a-zA-Z0-9_-]/g, '');

  // 验证清理后的ID是否仍然有效
  if (sanitized.length === 0 || sanitized.length > 100) {
    return null;
  }

  return sanitized;
}

module.exports = {
  generateTaskId,
  generateStepId,
  generateToolCallId,
  isValidTaskId,
  sanitizeTaskId
};
