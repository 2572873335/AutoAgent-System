/**
 * 工具系统测试脚本
 * 验证后端工具系统的基本功能
 */

const { TOOL_DEFINITIONS, toolExecutor } = require('../server/tools/registry.cjs');
const { generateTaskId } = require('../server/utils/id.cjs');
const { deepseekService } = require('../server/services/deepseek.cjs');

console.log('='.repeat(60));
console.log('Tool System Test');
console.log('='.repeat(60));

// 测试 1: 工具定义
console.log('\n[Test 1] Tool Definitions');
console.log(`Found ${TOOL_DEFINITIONS.length} tool definitions:`);
TOOL_DEFINITIONS.forEach(tool => {
  console.log(`  - ${tool.function.name}: ${tool.function.description.substring(0, 50)}...`);
});

// 测试 2: 任务ID生成
console.log('\n[Test 2] Task ID Generation');
const testId = generateTaskId();
console.log(`Generated task ID: ${testId}`);
const isValid = /^task_[a-zA-Z0-9_-]+$/.test(testId);
console.log(`ID format valid: ${isValid ? 'PASS' : 'FAIL'}`);

// 测试 3: DeepSeek服务配置
console.log('\n[Test 3] DeepSeek Service Configuration');
const isConfigured = deepseekService.isConfigured();
console.log(`API configured: ${isConfigured ? 'YES' : 'NO (set DEEPSEEK_API_KEY)'}`);

// 测试 4: 工具执行器
console.log('\n[Test 4] Tool Executor');
console.log(`Tool executor instance: ${toolExecutor ? 'EXISTS' : 'MISSING'}`);
console.log(`Executions map: ${toolExecutor.executions ? 'EXISTS' : 'MISSING'}`);

// 测试 5: 参数验证
console.log('\n[Test 5] Input Validation');
const testCases = [
  { tool: 'web_search', args: { query: 'a'.repeat(300) }, expected: 'fail' },
  { tool: 'web_search', args: { query: 'test query' }, expected: 'pass' },
  { tool: 'read_file', args: { filename: '../../../etc/passwd' }, expected: 'fail' },
  { tool: 'read_file', args: { filename: 'test.txt' }, expected: 'pass' },
  { tool: 'generate_ppt', args: { filename: 'test.pptx.exe' }, expected: 'fail' },
];

testCases.forEach(({ tool, args, expected }) => {
  const error = toolExecutor._validateArgs(tool, args);
  const result = error ? 'fail' : 'pass';
  const status = result === expected ? 'PASS' : 'FAIL';
  console.log(`  ${status}: ${tool} with ${JSON.stringify(args)} - ${error || 'valid'}`);
});

console.log('\n' + '='.repeat(60));
console.log('Basic tests completed');
console.log('='.repeat(60));
