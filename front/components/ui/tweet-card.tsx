'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { XData } from '@/db_lib/supabase';

interface XUser {
  user_id: string;
  user_name: string;
  screen_name: string;
  user_link: string;
  avatar?: string;
  expire: boolean;
  created_at: string;
  updated_at: string;
}

interface TweetCardProps {
  item: XData;
  users?: XUser[]; // 用户列表数据，用于获取头像信息
}

export function TweetCard({ item, users = [] }: TweetCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isTweet = item.x_id.startsWith('tweet-');
  const isProfileConversation = item.x_id.startsWith('profile-conversation-');
  
  // 监听 ESC 关闭预览
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, []);
  
  // 构建原文链接
  const getOriginalUrl = (): string | null => {
    const base = item.user_link as string | undefined;
    if (!base) return null;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const xid = item.x_id || '';
    if (xid.startsWith('tweet-')) {
      const tweetId = xid.substring(6);
      if (tweetId) return `${normalizedBase}/status/${tweetId}`;
    }
    if (xid.startsWith('profile-conversation-tweet-')) {
      const rest = xid.substring(27);
      const tweetId = rest.split('-tweet-')[0];
      if (tweetId) return `${normalizedBase}/status/${tweetId}`;
    }
    return null;
  };
  const originalUrl = getOriginalUrl();
  
  // 查找对应的用户数据以获取头像信息
  const currentUser = users.find(user => user.user_id === item.user_id);
  
  // 获取头像 URL，优先使用用户数据中的 avatar 字段
  const getAvatarUrl = () => {
    if (currentUser?.avatar) {
      return currentUser.avatar;
    }
    // 回退到默认头像 URL
    return `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${item.user_id}.png`;
  };
  
  // 渲染推文内容
  const renderTweetContent = (data: Record<string, unknown>, isSubItem: boolean = false) => {
    const fullText = data.full_text as string;
    const urls = data.urls as Record<string, string[]>;
    const medias = data.medias as Record<string, string[]>;
    
    return (
      <div className={`${isSubItem ? 'ml-4 pl-4 border-l-2 border-gray-200' : ''}`}>
        {fullText && (
          <div className="text-gray-900 mb-3 whitespace-pre-wrap">
            {fullText}
          </div>
        )}
        
        {/* 链接 */}
        {urls && Object.keys(urls).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full mb-2">
              链接
            </div>
            <div className="space-y-1">
              {Object.entries(urls).map(([, links]) =>
                links
                  .filter((link: string) => link !== null)
                  .map((link: string, index: number) => (
                    <div key={index}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm hover:underline"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        {link.length > 50 ? `${link.substring(0, 50)}...` : link}
                      </a>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
        
        {/* 媒体 */}
        {medias && Object.keys(medias).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full mb-2">
              媒体
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(medias).map(([, mediaLinks]) =>
                mediaLinks.map((media: string, index: number) => (
                  <div key={index} className="relative">
                    <img
                      src={media}
                      alt="媒体内容"
                      className="w-full h-24 object-cover rounded-lg border cursor-zoom-in"
                      onClick={() => setPreviewImage(media)}
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      {/* 头部信息 */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          {/* 用户头像 */}
          {item.user_id && (
            <img
              src={getAvatarUrl()}
              alt={currentUser?.user_name || item.username || '用户'}
              className="w-10 h-10 rounded-full bg-gray-200 border"
              onError={(e) => {
                // 使用与用户列表相同的错误处理逻辑
                const userName = currentUser?.user_name || item.username || '用户';
                e.currentTarget.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23e5e7eb"/><text x="20" y="25" text-anchor="middle" fill="%236b7280" font-size="12">${userName.charAt(0).toUpperCase()}</text></svg>`;
              }}
            />
          )}
          
          <div>
            {/* 用户名和链接 */}
            <div className="font-medium text-gray-900">
              {item.user_link ? (
                <a
                  href={item.user_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 hover:underline"
                >
                  @{item.username || '未知用户'}
                </a>
              ) : (
                `@${item.username || '未知用户'}`
              )}
            </div>

          </div>
        </div>
        
        {/* 时间与原文链接 */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            {new Date(
              (item as any).data?.created_at ?? (item as any).data?.[0]?.data?.created_at ?? item.created_at
            ).toLocaleString('zh-CN')}
          </span>
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="查看原文"
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="border-t pt-3">
        {isTweet && renderTweetContent(item.data)}
        
        {isProfileConversation && Array.isArray(item.data) && (
          <div className="space-y-4">
            {item.data.map((subItem: Record<string, unknown>, index: number) => (
              <div key={(subItem.x_id as string) || index}>
                {index > 0 && <div className="border-t pt-3 mt-3" />}
                {renderTweetContent(subItem.data as Record<string, unknown>, true)}
              </div>
            ))}
          </div>
        )}
        
        {/* 如果不是推文或对话，显示原始数据预览 */}
        {!isTweet && !isProfileConversation && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 mb-2">数据内容预览：</div>
            <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border max-h-20 overflow-y-auto">
              {typeof item.data === 'object' ? 
                JSON.stringify(item.data, null, 2).substring(0, 200) + (JSON.stringify(item.data).length > 200 ? '...' : '') :
                String(item.data).substring(0, 200) + (String(item.data).length > 200 ? '...' : '')
              }
            </div>
          </div>
        )}
      </div>

      {/* 图片预览遮罩 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] rounded shadow-xl cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png';
            }}
          />
        </div>
      )}
    </div>
  );
}
