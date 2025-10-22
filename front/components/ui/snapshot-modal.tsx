'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Download, Copy, Check, Loader2 } from 'lucide-react';
import { snapdom } from '@zumer/snapdom';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetElement: HTMLElement | null;
  tweetId?: string;
}

export function SnapshotModal({ isOpen, onClose, targetElement, tweetId }: SnapshotModalProps) {
  const [capturing, setCapturing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 捕获截图
  useEffect(() => {
    if (isOpen && targetElement && !imageUrl) {
      captureSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetElement]);

  // 监听 ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const captureSnapshot = async () => {
    if (!targetElement) return;

    try {
      setCapturing(true);

      // 使用 snapdom 捕获元素
      const result = await snapdom(targetElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const img = await result.toPng();
      setImageUrl(img.src);
    } catch (error) {
      console.error('截图失败:', error);
      alert('截图失败，请重试');
    } finally {
      setCapturing(false);
    }
  };

  const downloadImage = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tweet-${tweetId || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  const copyImage = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请重试');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 font-mono"
      onClick={onClose}
    >
      <div
        className="relative bg-background border-2 border-foreground max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider">
            [SNAPSHOT]
          </h3>
          <button
            onClick={onClose}
            className="p-2 border border-transparent hover:border-foreground transition-all"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {capturing ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-xs uppercase tracking-wider">[GENERATING...]</p>
            </div>
          ) : imageUrl ? (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="推文截图"
                className="max-w-full h-auto border border-border"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 opacity-60">
              <p className="text-xs uppercase tracking-wider">[FAILED]</p>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        {imageUrl && !capturing && (
          <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-border">
            <button
              onClick={copyImage}
              disabled={copied}
              className="flex items-center gap-2 px-6 py-2.5 border border-foreground font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 hover:bg-foreground hover:text-background"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>[COPIED]</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>[COPY]</span>
                </>
              )}
            </button>

            <button
              onClick={downloadImage}
              className="flex items-center gap-2 px-6 py-2.5 border border-foreground font-bold text-xs uppercase tracking-wider transition-all hover:bg-foreground hover:text-background"
            >
              <Download size={16} />
              <span>[DOWNLOAD]</span>
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

