import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEntry } from '@/types';

interface LogViewerProps {
  logs: LogEntry[];
}

const levelConfig = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-950/30' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-950/30' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-950/30' },
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30' },
};

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className="border-slate-700 bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800">
            <Terminal className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-100">System Logs</CardTitle>
            <p className="text-sm text-slate-400">{logs.length} entries</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-64 rounded-lg bg-slate-950 border border-slate-800">
          <div ref={scrollRef} className="p-4 space-y-2">
            {logs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No logs yet...</p>
            ) : (
              logs.map((log, index) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-3 p-2 rounded ${config.bg}`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTime(log.timestamp)}
                        </span>
                        <span className={`text-xs font-medium uppercase ${config.color}`}>
                          {log.level}
                        </span>
                        {log.agentId && (
                          <span className="text-xs text-violet-400 bg-violet-950 px-1.5 py-0.5 rounded">
                            Agent: {log.agentId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mt-1">{log.message}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LogViewer;
