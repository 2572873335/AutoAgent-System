/**
 * FileGallery - 文件画廊组件
 * 展示多个生成的文件，支持预览和下载
 */

import { useState } from 'react';
import { Download, Eye, FileText, Image, File, Presentation, FileCode } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FilePreviewDialog } from './FilePreviewDialog';
import type { DownloadItem, PreviewFile } from '@/types/tools';
import { toPreviewFile, getFileType } from '@/hooks/useFilePreview';

// API 基础 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

interface FileGalleryProps {
  files: DownloadItem[];
  title?: string;
  className?: string;
}

export function FileGallery({
  files,
  title = '生成的文件',
  className,
}: FileGalleryProps) {
  const [selectedFile, setSelectedFile] = useState<PreviewFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!files || files.length === 0) return null;

  // 打开预览
  const openPreview = (file: DownloadItem) => {
    setSelectedFile(toPreviewFile(file));
    setIsPreviewOpen(true);
  };

  // 关闭预览
  const closePreview = () => {
    setIsPreviewOpen(false);
    setTimeout(() => setSelectedFile(null), 300);
  };

  // 处理下载
  const handleDownload = (file: DownloadItem) => {
    const fullUrl = getFullUrl(file.url);
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 批量下载
  const handleDownloadAll = () => {
    files.forEach((file, index) => {
      setTimeout(() => handleDownload(file), index * 500);
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          {title}
          <span className="ml-2 text-xs text-slate-500">({files.length})</span>
        </h3>
        {files.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadAll}
            className="h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            全部下载
          </Button>
        )}
      </div>

      {/* 文件网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {files.map((file, index) => (
          <FileCard
            key={`${file.name}-${index}`}
            file={file}
            onPreview={() => openPreview(file)}
            onDownload={() => handleDownload(file)}
          />
        ))}
      </div>

      {/* 预览对话框 */}
      <FilePreviewDialog
        file={selectedFile}
        isOpen={isPreviewOpen}
        onClose={closePreview}
      />
    </div>
  );
}

// 单个文件卡片
interface FileCardProps {
  file: DownloadItem;
  onPreview: () => void;
  onDownload: () => void;
}

function FileCard({ file, onPreview, onDownload }: FileCardProps) {
  const fileType = getFileType(file.name);
  const isPreviewable = fileType !== 'unknown';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative flex items-center gap-3 p-3 rounded-lg',
        'bg-slate-900/50 border border-slate-800',
        'hover:border-slate-700 hover:bg-slate-800/50',
        'transition-all duration-200'
      )}
    >
      {/* 文件图标 */}
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
        'bg-slate-800 group-hover:bg-slate-700',
        'transition-colors duration-200'
      )}>
        <FileIcon type={fileType} className="h-5 w-5" />
      </div>

      {/* 文件信息 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
          {file.name}
        </p>
        {file.size && (
          <p className="text-xs text-slate-500">{file.size}</p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isPreviewable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPreview}
            className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30"
            title="预览"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDownload}
          className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30"
          title="下载"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// 文件类型图标
interface FileIconProps {
  type: ReturnType<typeof getFileType>;
  className?: string;
}

function FileIcon({ type, className }: FileIconProps) {
  switch (type) {
    case 'pdf':
      return <FileText className={cn('text-red-400', className)} />;
    case 'image':
      return <Image className={cn('text-purple-400', className)} />;
    case 'pptx':
      return <Presentation className={cn('text-orange-400', className)} />;
    case 'text':
    case 'markdown':
      return <FileCode className={cn('text-blue-400', className)} />;
    default:
      return <File className={cn('text-slate-400', className)} />;
  }
}

// 辅助函数：获取完整 URL
function getFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_URL.replace('/api', '')}${normalizedUrl}`;
}

export default FileGallery;
