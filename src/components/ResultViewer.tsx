import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Copy, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ResultViewerProps {
  result: string;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-result-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-950">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-100">Execution Result</CardTitle>
                <p className="text-sm text-slate-400">Task completed successfully</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 mr-1 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xs text-slate-500 ml-2">result.md</span>
            </div>
            <div className="p-4 max-h-96 overflow-auto">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {result}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ResultViewer;
