import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Github, Code, CheckCircle, XCircle, Clock, 
  ChevronDown, ChevronUp, Terminal, Wrench 
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent;
  index: number;
}

const statusConfig = {
  idle: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-800', label: 'Idle' },
  running: { icon: Terminal, color: 'text-cyan-400', bg: 'bg-cyan-950', label: 'Running' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950', label: 'Completed' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-950', label: 'Error' },
};

const sourceConfig = {
  generated: { icon: Code, label: 'Auto-Generated', color: 'text-violet-400 bg-violet-950' },
  github: { icon: Github, label: 'GitHub', color: 'text-slate-300 bg-slate-800' },
  local: { icon: Bot, label: 'Local', color: 'text-amber-400 bg-amber-950' },
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, index }) => {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[agent.status];
  const source = sourceConfig[agent.source];
  const StatusIcon = status.icon;
  const SourceIcon = source.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="border-slate-700 bg-slate-900/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="p-4 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${status.bg}`}>
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100">{agent.name}</h4>
                <p className="text-sm text-slate-400 line-clamp-1">{agent.description}</p>
              </div>
            </div>
            <Badge className={`${source.color} border-0`}>
              <SourceIcon className="h-3 w-3 mr-1" />
              {source.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Skills */}
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Wrench className="h-3 w-3" />
              <span>Skills ({agent.skills.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills.slice(0, 3).map((skill) => (
                <Badge
                  key={skill.id}
                  variant="outline"
                  className="text-xs border-slate-700 text-slate-400"
                >
                  {skill.name}
                </Badge>
              ))}
              {agent.skills.length > 3 && (
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                  +{agent.skills.length - 3}
                </Badge>
              )}
            </div>
          </div>

          {/* Status and timing */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`${status.color}`}>{status.label}</span>
              {agent.completedAt && agent.createdAt && (
                <span className="text-slate-500">
                  ({((agent.completedAt - agent.createdAt) / 1000).toFixed(1)}s)
                </span>
              )}
            </div>
            {agent.githubUrl && (
              <a
                href={agent.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-xs"
              >
                View on GitHub →
              </a>
            )}
          </div>

          {/* Code preview */}
          {agent.code && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full justify-between text-slate-400 hover:text-slate-200"
              >
                <span className="text-xs">View generated code</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto max-h-48">
                      <code>{agent.code}</code>
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Error display */}
          {agent.error && (
            <div className="mt-3 p-3 bg-red-950/50 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{agent.error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AgentCard;
;
