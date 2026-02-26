/**
 * FilePreviewDialog - 文件预览对话框
 * 使用 Dialog 组件创建模态预览窗口
 */

import { useState, useEffect } from 'react';
import { Download, ZoomIn, ZoomOut, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilePreview } from './FilePreview';
import type { PreviewFile } from '@/types/tools';
import { getFileType } from '@/hooks/useFilePreview';

// API 基础 URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// 辅助函数：获取完整 URL
function getFullUrl(url: string, baseUrl: string = API_URL): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl.replace('/api', '')}${normalizedUrl}`;
}

interface FilePreviewDialogProps {
  file: PreviewFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export function FilePreviewDialog({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewDialogProps) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 重置缩放比例当文件改变时
  useEffect(() => {
    setScale(1);
  }, [file?.name]);

  if (!file) return null;

  const fileType = getFileType(file.name);
  const fullUrl = getFullUrl(file.url, API_URL);

  // 处理下载
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // 默认下载行为
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 放大
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));

  // 缩小
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  // 切换全屏
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 在新窗口打开
  const openInNewTab = () => {
    window.open(fullUrl, '_blank');
  };

  // 是否可以缩放（仅图片和PDF）
  const canZoom = fileType === 'image' || fileType === 'pdf';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-w-5xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-slate-900 border-slate-700',
          isFullscreen && 'max-w-none w-screen h-screen max-h-screen rounded-none'
        )}
      >
        {/* 头部 */}
        <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{getFileIcon(file.name)}</span>
              <DialogTitle className="text-slate-100 text-lg truncate">
                {file.name}
              </DialogTitle>
              {file.size && (
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  ({file.size})
                </span>
              )}
            </div>

            {/* 工具栏 */}
            <div className="flex items-center gap-1 ml-4">
              {canZoom && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={zoomOut}
                    className="h-8 w-8 text-slate-400 hover:text-slate-100"
                    title="缩小"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-slate-500 w-12 text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={zoomIn}
                    className="h-8 w-8 text-slate-400 hover:text-slate-100"
                    title="放大"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={openInNewTab}
                className="h-8 w-8 text-slate-400 hover:text-slate-100"
                title="在新窗口打开"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleFullscreen}
                className="h-8 w-8 text-slate-400 hover:text-slate-100"
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>

              <div className="w-px h-6 bg-slate-700 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50"
              >
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 预览内容 */}
        <div className="flex-1 overflow-auto bg-slate-950 p-6">
          <motion.div
            style={{
              transform: canZoom ? `scale(${scale})` : undefined,
              transformOrigin: 'center top',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <FilePreview file={file} />
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 获取文件图标
function getFileIcon(filename: string): string {
  const type = getFileType(filename);
  const iconMap: Record<string, string> = {
    pdf: '📄',
    image: '🖼️',
    text: '📝',
    markdown: '📑',
    pptx: '📊',
    unknown: '📎',
  };
  return iconMap[type] || '📎';
}

export default FilePreviewDialog;
