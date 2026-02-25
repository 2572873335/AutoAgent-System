import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, RotateCcw, Loader2, CheckCircle2, XCircle,
  Search, Presentation, FileText, Download, Wrench,
  Brain, Sparkles, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAgentStream } from '@/hooks/useAgentStream';
import type { ToolDefinition } from '@/types';

interface TaskExecutorProps {
  className?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const toolIcons: Record<string, typeof Search> = {
  web_search: Search,
  generate_ppt: Presentation,
  read_file: FileText
};

const statusConfig = {
  idle: { label: 'Ready', color: 'text-slate-400', bg: 'bg-slate-800' },
  planning: { label: 'Planning', color: 'text-amber-400', bg: 'bg-amber-950' },
  executing: { label: 'Executing Tools', color: 'text-blue-400', bg: 'bg-blue-950' },
  synthesizing: { label: 'Synthesizing', color: 'text-violet-400', bg: 'bg-violet-950' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-950' },
  error: { label: 'Error', color: 'text-red-400', bg: 'bg-red-950' }
};

export function TaskExecutor({ className }: TaskExecutorProps) {
  const [input, setInput] = useState('');
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);
  const { state, isLoading, executeTask, cancelTask, resetState } = useAgentStream();

  // 加载可用工具列表
  useEffect(() => {
    fetch(`${API_URL}/tools/list`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTools(data.tools);
        }
      })
      .catch(err => console.error('Failed to load tools:', err));
  }, []);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    executeTask(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const currentStatus = statusConfig[state.status];

  return (
    <div className={cn('space-y-6', className)}>
      {/* 输入区域 */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-cyan-400" />
              <CardTitle className="text-lg text-slate-100">Agent with Tools</CardTitle>
            </div>
            {availableTools.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Available tools:</span>
                {availableTools.map(tool => (
                  <Badge
                    key={tool.name}
                    variant="outline"
                    className="border-slate-700 text-slate-400 text-xs"
                  >
                    {tool.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Describe your task... (e.g., 'Search for latest AI trends and create a presentation')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[100px] bg-slate-950 border-slate-800 text-slate-100 resize-none"
          />

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Press Ctrl+Enter to submit
            </div>
            <div className="flex items-center gap-2">
              {state.status !== 'idle' && state.status !== 'completed' && state.status !== 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelTask}
                  className="border-slate-700 text-slate-400 hover:text-red-400"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              )}
              {(state.status === 'completed' || state.status === 'error') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="border-slate-700 text-slate-400"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Execute
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 执行状态 */}
      <AnimatePresence>
        {state.status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-violet-400" />
                    <CardTitle className="text-lg text-slate-100">Execution Status</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      currentStatus.bg,
                      currentStatus.color
                    )}
                  >
                    {currentStatus.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 当前思考状态 */}
                {state.thought && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800"
                  >
                    {state.status === 'planning' && (
                      <Loader2 className="h-5 w-5 text-amber-400 animate-spin mt-0.5" />
                    )}
                    {state.status === 'executing' && (
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin mt-0.5" />
                    )}
                    {state.status === 'synthesizing' && (
                      <Loader2 className="h-5 w-5 text-violet-400 animate-spin mt-0.5" />
                    )}
                    {(state.status === 'completed' || state.status === 'error') && !isLoading && (
                      <Sparkles className="h-5 w-5 text-emerald-400 mt-0.5" />
                    )}
                    <p className="text-sm text-slate-300">{state.thought}</p>
                  </motion.div>
                )}

                {/* 工具执行步骤 */}
                {state.steps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-400">Tool Calls</h4>
                    <div className="space-y-2">
                      {state.steps.map((step, index) => {
                        const Icon = toolIcons[step.tool] || Wrench;
                        return (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-lg border',
                              step.status === 'running' && 'bg-blue-950/30 border-blue-800',
                              step.status === 'success' && 'bg-emerald-950/30 border-emerald-800',
                              step.status === 'error' && 'bg-red-950/30 border-red-800',
                              step.status === 'pending' && 'bg-slate-950 border-slate-800'
                            )}
                          >
                            <div className={cn(
                              'p-2 rounded-lg',
                              step.status === 'running' && 'bg-blue-900/50',
                              step.status === 'success' && 'bg-emerald-900/50',
                              step.status === 'error' && 'bg-red-900/50',
                              step.status === 'pending' && 'bg-slate-800'
                            )}>
                              <Icon className={cn(
                                'h-4 w-4',
                                step.status === 'running' && 'text-blue-400',
                                step.status === 'success' && 'text-emerald-400',
                                step.status === 'error' && 'text-red-400',
                                step.status === 'pending' && 'text-slate-400'
                              )} />
                            </div>

                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-200">
                                {step.tool}
                              </p>
                              {step.error && (
                                <p className="text-xs text-red-400 mt-1">{step.error}</p>
                              )}
                            </div>

                            <div>
                              {step.status === 'running' && (
                                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                              )}
                              {step.status === 'success' && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              )}
                              {step.status === 'error' && (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 最终答案 */}
                {state.finalAnswer && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800"
                  >
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Result</h4>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-slate-300">
                        {state.finalAnswer}
                      </pre>
                    </div>
                  </motion.div>
                )}

                {/* 下载链接 */}
                {state.downloads.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                  >
                    <h4 className="text-sm font-medium text-slate-400">Downloads</h4>
                    <div className="flex flex-wrap gap-2">
                      {state.downloads.map((download, index) => (
                        <a
                          key={index}
                          href={`${API_URL}${download.url}`}
                          download={download.name}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-950/50 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/50 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-sm">{download.name}</span>
                          {download.size && (
                            <span className="text-xs text-cyan-500">({download.size})</span>
                          )}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 错误信息 */}
                {state.error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-red-950/30 border border-red-800"
                  >
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-400">Error</p>
                      <p className="text-sm text-red-300">{state.error}</p>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
