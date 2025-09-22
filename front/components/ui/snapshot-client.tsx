'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { TweetCard } from '@/components/ui/tweet-card';
import type { XData, XUser } from '@/db_lib/supabase';

export default function SnapshotClient({ item, users = [] }: { item: XData; users?: XUser[] }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const generate = async () => {
      try {
        // 等待图片和字体大致加载
        await new Promise((r) => setTimeout(r, 400));
        if (!captureRef.current) return;
        const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBg9YkSU0AAAAASUVORK5CYII=';
        const dataUrl = await toPng(captureRef.current, {
          cacheBust: false,
          imagePlaceholder: transparentPixel,
          fetchRequestInit: { mode: 'cors', credentials: 'omit' },
          pixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
          filter: (node) => !(node instanceof HTMLElement && node.hasAttribute('data-no-snapshot')),
          backgroundColor: '#ffffff',
        });
        if (!mounted) return;
        setImgSrc(dataUrl);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : '快照生成失败');
      }
    };
    generate();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = () => {
    if (!imgSrc) return;
    const link = document.createElement('a');
    const fileSafeId = (item.x_id || 'tweet').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${fileSafeId}.png`;
    link.href = imgSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div ref={captureRef} className="bg-white">
        <TweetCard item={item} users={users} />
      </div>
      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
      {imgSrc && (
        <div className="space-y-2">
          <button
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            onClick={handleDownload}
          >
            下载 PNG
          </button>
          <div className="border rounded p-2 bg-white">
            <img src={imgSrc} alt="快照" className="w-full h-auto" />
          </div>
        </div>
      )}
    </div>
  );
}


