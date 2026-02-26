/**
 * File Preview Hook - 管理文件预览状态
 */

import { useState, useCallback, useMemo } from 'react';
import type { PreviewFile, PreviewFileType, DownloadItem } from '@/types/tools';

// 根据文件名判断文件类型
export function getFileType(filename: string): PreviewFileType {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return 'image';
    case 'txt':
    case 'json':
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'py':
    case 'html':
    case 'css':
    case 'yaml':
    case 'yml':
    case 'xml':
      return 'text';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'pptx':
    case 'ppt':
      return 'pptx';
    default:
      return 'unknown';
  }
}

// 判断文件是否可预览
export function isPreviewable(filename: string): boolean {
  const type = getFileType(filename);
  return type !== 'unknown';
}

// 获取文件图标
export function getFileIcon(filename: string): string {
  const type = getFileType(filename);
  const iconMap: Record<PreviewFileType, string> = {
    pdf: '📄',
    image: '🖼️',
    text: '📝',
    markdown: '📑',
    pptx: '📊',
    unknown: '📎',
  };
  return iconMap[type];
}

// 将 DownloadItem 转换为 PreviewFile
export function toPreviewFile(item: DownloadItem): PreviewFile {
  return {
    name: item.name,
    url: item.url,
    size: item.size,
    type: getFileType(item.name),
    mimeType: item.type,
  };
}

export interface UseFilePreviewReturn {
  // 当前预览的文件
  currentFile: PreviewFile | null;
  // 是否打开预览对话框
  isOpen: boolean;
  // 打开预览
  openPreview: (file: PreviewFile | DownloadItem) => void;
  // 关闭预览
  closePreview: () => void;
  // 获取完整 URL
  getFullUrl: (url: string) => string;
  // 支持的文件类型判断
  getFileType: (filename: string) => PreviewFileType;
  isPreviewable: (filename: string) => boolean;
  getFileIcon: (filename: string) => string;
}

export function useFilePreview(apiUrl: string = ''): UseFilePreviewReturn {
  const [currentFile, setCurrentFile] = useState<PreviewFile | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openPreview = useCallback((file: PreviewFile | DownloadItem) => {
    const previewFile = 'type' in file && file.type && ['pdf', 'image', 'text', 'markdown', 'pptx', 'unknown'].includes(file.type)
      ? file as PreviewFile
      : toPreviewFile(file as DownloadItem);

    setCurrentFile(previewFile);
    setIsOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    // 延迟清空文件，等待动画结束
    setTimeout(() => setCurrentFile(null), 300);
  }, []);

  const getFullUrl = useCallback((url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    // 确保 URL 以 / 开头
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    return `${apiUrl}${normalizedUrl}`;
  }, [apiUrl]);

  return useMemo(() => ({
    currentFile,
    isOpen,
    openPreview,
    closePreview,
    getFullUrl,
    getFileType,
    isPreviewable,
    getFileIcon,
  }), [currentFile, isOpen, openPreview, closePreview, getFullUrl]);
}

export default useFilePreview;
