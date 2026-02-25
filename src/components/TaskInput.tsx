import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface TaskInputProps {
  onSubmit: (task: string) => void;
  isProcessing: boolean;
}

const EXAMPLE_TASKS = [
  'Research the latest AI trends and summarize findings',
  'Analyze sales data and create visualizations',
  'Write a blog post about machine learning',
  'Build a web scraper to collect product prices',
  'Create a code review agent for Python projects',
];

export const TaskInput: React.FC<TaskInputProps> = ({ onSubmit, isProcessing }) => {
  const [task, setTask] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task.trim() && !isProcessing) {
      onSubmit(task.trim());
    }
  };

  const handleExampleClick = (example: string) => {
    setTask(example);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto"
    >
      <Card className="border-2 border-dashed border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <Textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe your task... The system will automatically generate or discover agents to complete it."
                className="min-h-[140px] bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none pr-14 text-base"
                disabled={isProcessing}
              />
              <Button
                type="submit"
                disabled={!task.trim() || isProcessing}
                className="absolute bottom-3 right-3 h-10 w-10 p-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
              <Sparkles className="h-4 w-4" />
              <span>Example tasks</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_TASKS.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors disabled:opacity-50 text-left"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TaskInput;
