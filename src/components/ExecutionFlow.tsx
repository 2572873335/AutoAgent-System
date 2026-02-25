import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Play, CheckCircle, XCircle, Clock, ArrowRight,
  GitBranch, Layers, Zap, Image
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Task, SubTask } from '@/types';

interface ExecutionFlowProps {
  task: Task;
}

const statusIcons = {
  pending: Clock,
  waiting: Clock,
  running: Play,
  completed: CheckCircle,
  error: XCircle,
};

const statusColors = {
  pending: 'text-slate-400 bg-slate-800 border-slate-700',
  waiting: 'text-amber-400 bg-amber-950 border-amber-800',
  running: 'text-cyan-400 bg-cyan-950 border-cyan-600 animate-pulse',
  completed: 'text-emerald-400 bg-emerald-950 border-emerald-600',
  error: 'text-red-400 bg-red-950 border-red-600',
};

// 批次颜色，用于标识同一批次的任务
const batchColors = [
  'border-purple-500 bg-purple-950/50',
  'border-blue-500 bg-blue-950/50',
  'border-green-500 bg-green-950/50',
  'border-orange-500 bg-orange-950/50',
  'border-pink-500 bg-pink-950/50',
];

export const ExecutionFlow: React.FC<ExecutionFlowProps> = ({ task }) => {
  // Group subtasks by execution phase (based on dependencies)
  const executionGroups = useMemo(() => {
    const groups: SubTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...task.subTasks];

    while (remaining.length > 0) {
      const group: SubTask[] = [];
      const stillRemaining: SubTask[] = [];

      for (const subTask of remaining) {
        const depsSatisfied = subTask.dependencies.every(dep =>
          completed.has(dep) || !task.subTasks.find(st => st.id === dep)
        );

        if (depsSatisfied) {
          group.push(subTask);
        } else {
          stillRemaining.push(subTask);
        }
      }

      if (group.length === 0 && stillRemaining.length > 0) {
        // Avoid infinite loop - add remaining to group
        group.push(...stillRemaining);
        stillRemaining.length = 0;
      }

      groups.push(group);
      for (const st of group) {
        completed.add(st.id);
      }
      remaining.length = 0;
      remaining.push(...stillRemaining);
    }

    return groups;
  }, [task.subTasks]);

  // 检测是否为图片生成任务
  const isImageGenerationTask = useMemo(() => {
    return task.subTasks.some(st =>
      st.description.includes('image') ||
      st.description.includes('图片') ||
      st.description.includes('storyboard') ||
      st.description.includes('分镜') ||
      st.description.includes('Generate') && st.description.includes('batch')
    );
  }, [task.subTasks]);

  // 计算预估时间
  const estimatedTime = useMemo(() => {
    const baseTimePerTask = isImageGenerationTask ? 15 : 5;
    const totalSeconds = task.subTasks.length * baseTimePerTask;
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }, [task.subTasks.length, isImageGenerationTask]);

  // 计算当前运行中的任务数量
  const runningCount = useMemo(() => {
    return task.subTasks.filter(st => st.status === 'running').length;
  }, [task.subTasks]);

  const completedCount = task.subTasks.filter(st => st.status === 'completed').length;
  const progress = task.subTasks.length > 0 ? (completedCount / task.subTasks.length) * 100 : 0;

  // 获取批处理任务的批次索引
  const getBatchIndex = (subTask: SubTask): number => {
    const desc = subTask.description.toLowerCase();
    if (desc.includes('batch')) {
      const match = desc.match(/batch\s*(\d+)/i);
      if (match) {
        return parseInt(match[1]) % batchColors.length;
      }
    }
    return -1;
  };

  return (
    <Card className="border-slate-700 bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950">
              {isImageGenerationTask ? (
                <Image className="h-5 w-5 text-purple-400" />
              ) : (
                <GitBranch className="h-5 w-5 text-cyan-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg text-slate-100">
                {isImageGenerationTask ? 'Image Generation' : 'Execution Flow'}
              </CardTitle>
              <p className="text-sm text-slate-400">
                {executionGroups.length} parallel groups · {task.subTasks.length} subtasks
                {isImageGenerationTask && ' · Optimized for batch generation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runningCount > 0 && (
              <Badge variant="outline" className="border-cyan-700 text-cyan-400">
                <Zap className="h-3 w-3 mr-1 animate-pulse" />
                {runningCount} running
              </Badge>
            )}
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              <Layers className="h-3 w-3 mr-1" />
              {completedCount}/{task.subTasks.length} Complete
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>Est. {estimatedTime}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${isImageGenerationTask
                ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {executionGroups.map((group, groupIndex) => {
            const isParallel = group.length > 1;
            const hasRunning = group.some(st => st.status === 'running');

            return (
              <motion.div
                key={groupIndex}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: groupIndex * 0.1 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${isParallel
                      ? 'border-purple-700 text-purple-400'
                      : 'border-slate-700 text-slate-400'}`}
                  >
                    {isParallel && <Zap className="h-3 w-3 mr-1" />}
                    Group {groupIndex + 1}
                  </Badge>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-500">
                    {hasRunning ? (
                      <span className="text-cyan-400">
                        {group.filter(st => st.status === 'running').length} running ·{' '}
                      </span>
                    ) : null}
                    {group.filter(st => st.status === 'completed').length}/{group.length} done
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map((subTask, taskIndex) => {
                    const Icon = statusIcons[subTask.status];
                    const statusClass = statusColors[subTask.status];
                    const agent = task.agents.find(a => a.id === subTask.agentId);
                    const batchIdx = getBatchIndex(subTask);
                    const batchClass = batchIdx >= 0 ? batchColors[batchIdx] : '';

                    return (
                      <motion.div
                        key={subTask.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: taskIndex * 0.05 }}
                        className={`p-3 rounded-lg border ${statusClass} ${batchClass}`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{subTask.description}</p>
                            {agent && (
                              <p className="text-xs opacity-70 mt-1">
                                Agent: {agent.name}
                              </p>
                            )}
                            {subTask.startedAt && subTask.completedAt && (
                              <p className="text-xs opacity-50 mt-1">
                                {(subTask.completedAt - subTask.startedAt) / 1000}s
                              </p>
                            )}
                            {/* 显示批次信息 */}
                            {batchIdx >= 0 && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-xs border-purple-700/50 text-purple-400"
                              >
                                Batch {batchIdx + 1}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dependencies visualization */}
        {task.subTasks.some(st => st.dependencies.length > 0) && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-sm text-slate-400 mb-3">Dependency Chain</p>
            <div className="flex flex-wrap items-center gap-2">
              {task.subTasks.map((subTask, index) => (
                <div key={subTask.id} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-full text-xs border ${statusColors[subTask.status]}`}>
                    {index + 1}
                  </div>
                  {index < task.subTasks.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-slate-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExecutionFlow;
