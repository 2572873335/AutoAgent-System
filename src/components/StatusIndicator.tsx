import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Network, Zap, CheckCircle,
  AlertCircle, Clock, Search, Code, Bot
} from 'lucide-react';
import type { Task } from '@/types';

interface StatusIndicatorProps {
  task: Task | null;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    description: 'Waiting to start',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
    animate: false,
  },
  analyzing: {
    icon: Brain,
    label: 'Analyzing',
    description: 'Understanding task requirements',
    color: 'text-violet-400',
    bg: 'bg-violet-950',
    animate: true,
  },
  planning: {
    icon: Network,
    label: 'Planning',
    description: 'Decomposing task and discovering agents',
    color: 'text-cyan-400',
    bg: 'bg-cyan-950',
    animate: true,
  },
  executing: {
    icon: Zap,
    label: 'Executing',
    description: 'Running agents in parallel',
    color: 'text-amber-400',
    bg: 'bg-amber-950',
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    description: 'Task finished successfully',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    description: 'Task execution failed',
    color: 'text-red-400',
    bg: 'bg-red-950',
    animate: false,
  },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ task }) => {
  const [now, setNow] = useState(() => Date.now());

  // Update time every second for running tasks
  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status]);

  if (!task) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Bot className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">Submit a task to get started</p>
        </div>
      </div>
    );
  }

  const config = statusConfig[task.status];
  const Icon = config.icon;
  const duration = task.startedAt
    ? ((task.completedAt || now) - task.startedAt) / 1000
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full"
    >
      <div className="flex items-center gap-6 p-6 rounded-xl bg-slate-900/80 border border-slate-700 backdrop-blur-sm">
        {/* Status Icon */}
        <div className={`p-4 rounded-2xl ${config.bg}`}>
          {config.animate ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Icon className={`h-8 w-8 ${config.color}`} />
            </motion.div>
          ) : (
            <Icon className={`h-8 w-8 ${config.color}`} />
          )}
        </div>

        {/* Status Info */}
        <div className="flex-1">
          <h3 className={`text-xl font-semibold ${config.color}`}>
            {config.label}
          </h3>
          <p className="text-slate-400 mt-1">{config.description}</p>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {task.agents.length}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Agents</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {task.subTasks.length}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Subtasks</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {duration !== null ? `${duration.toFixed(1)}s` : '-'}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Duration</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mt-4 flex items-center justify-between px-2">
        {[
          { key: 'pending', label: 'Pending', icon: Clock },
          { key: 'analyzing', label: 'Analyze', icon: Search },
          { key: 'planning', label: 'Plan', icon: Code },
          { key: 'executing', label: 'Execute', icon: Zap },
          { key: 'completed', label: 'Complete', icon: CheckCircle },
        ].map((step, index) => {
          const StepIcon = step.icon;
          const isActive = ['pending', 'analyzing', 'planning', 'executing', 'completed'].indexOf(task.status) >= index;
          const isCurrent = task.status === step.key;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                <div className={`p-1.5 rounded-full ${isCurrent ? config.bg : isActive ? 'bg-slate-800' : 'bg-slate-900'}`}>
                  <StepIcon className={`h-4 w-4 ${isCurrent ? config.color : ''}`} />
                </div>
                <span className="text-sm hidden sm:inline">{step.label}</span>
              </div>
              {index < 4 && (
                <div className={`flex-1 h-px mx-4 ${isActive ? 'bg-slate-600' : 'bg-slate-800'}`} />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default StatusIndicator;
