/**
 * FilePreview - 文件预览组件
 * 支持 PDF、图片、文本、Markdown 等多种文件类型的预览
 */

import { useState, useEffect } from 'react';
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilePreviewProps } from '@/types/tools';
import { getFileType } from '@/hooks/useFilePreview';

// API 基础 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export function FilePreview({ file, className }: FilePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');

  const fileType = file.type || getFileType(file.name);
  const fullUrl = getFullUrl(file.url, API_URL);

  // 加载文本内容
  useEffect(() => {
    if (fileType === 'text' || fileType === 'markdown') {
      fetch(fullUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [fileType, fullUrl]);

  // PDF 预览
  if (fileType === 'pdf') {
    return (
      <div className={cn('w-full h-[600px] bg-slate-950 rounded-lg overflow-hidden', className)}>
        <embed
          src={fullUrl}
          type="application/pdf"
          className="w-full h-full"
          onLoad={() => setLoading(false)}
        />
      </div>
    );
  }

  // 图片预览
  if (fileType === 'image') {
    return (
      <div className={cn('flex items-center justify-center bg-slate-950 rounded-lg p-4 min-h-[300px]', className)}>
        {loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>加载图片中...</span>
          </div>
        )}
        <img
          src={fullUrl}
          alt={file.name}
          className={cn('max-w-full max-h-[600px] object-contain rounded', loading && 'hidden')}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('图片加载失败');
          }}
        />
        {error && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <ImageIcon className="h-12 w-12" />
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // 文本/Markdown 预览
  if (fileType === 'text' || fileType === 'markdown') {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[300px] text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>加载内容中...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
          <FileText className="h-12 w-12 mb-2" />
          <p>{error}</p>
        </div>
      );
    }

    return (
      <div className={cn('bg-slate-950 rounded-lg overflow-hidden', className)}>
        <pre className="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap break-words max-h-[600px] overflow-auto">
          {content}
        </pre>
      </div>
    );
  }

  // PPT 或其他不支持直接预览的文件
  return (
    <div className={cn('flex flex-col items-center justify-center h-[300px] bg-slate-950 rounded-lg', className)}>
      <div className="text-6xl mb-4">📊</div>
      <p className="text-slate-400 mb-2">{file.name}</p>
      <p className="text-sm text-slate-500">
        {fileType === 'pptx' ? 'PPT 演示文稿' : '此文件类型暂不支持预览'}</p>
      {file.size && <p className="text-xs text-slate-600 mt-1">{file.size}</p>}
    </div>
  );
}

// 辅助函数：获取完整 URL
function getFullUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl.replace('/api', '')}${normalizedUrl}`;
}

export default FilePreview;
