'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { ExternalLink, Sparkles, Camera } from 'lucide-react';
import { XData } from '@/db_lib/supabase';
import { getProxiedImageUrl } from '@/db_lib/image-utils';
import { formatRelativeTime } from '@/components/ui/time-utils';


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

// 可折叠文本组件
function CollapsibleText({ 
  text, 
  limit = 500,
  renderContent 
}: { 
  text: string; 
  limit?: number;
  renderContent?: (text: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;
  
  const isLong = text.length > limit;
  const displayText = expanded ? text : text.slice(0, limit);
  
  return (
    <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
      {renderContent ? renderContent(displayText) : displayText}
      {isLong && !expanded && (
        <>
          <span className="text-gray-500 dark:text-gray-400">...</span>
          <button
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-sm ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            展开全文
          </button>
        </>
      )}
      {isLong && expanded && (
        <>
          <span className="text-gray-500 dark:text-gray-400">  </span>
        <button
          className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-sm ml-1"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
        >
          <span>收起</span>
        </button>
        </>
      )}
    </div>
  );
}

export function TweetCard({ item, users = [] }: TweetCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const isTweet = item.x_id.startsWith('tweet-');
  const isProfileConversation = item.x_id.startsWith('profile-conversation-');
  
  // 提取AI分析结果
  const getAIResult = () => {
    try {
      // 优先从 more_info 字段获取 ai_result
      if (item.more_info?.ai_result) {
        return item.more_info.ai_result;
      }
      // 兼容性处理：如果 more_info 中没有，尝试从 data 字段获取（用于迁移期间）
      // const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      // return data?.ai_result || null;
    } catch {
      return null;
    }
  };
  
  const aiResult = getAIResult();
  
  // 渲染AI分析结果
  const renderAIAnalysis = () => {
    // 只显示重要信号（is_important: true 且有 summary）
    if (!aiResult || !aiResult.summary || aiResult.is_important === false) return null;
    
    return (
      <div className="mb-3 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* 内容主体 */}
      <div className="flex items-start space-x-2">
        <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0 drop-shadow-sm" />
        <div className="flex-1">
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
          <span className="font-semibold bg-gradient-to-r from-blue-500 dark:from-blue-400 to-indigo-600 dark:to-indigo-400 bg-clip-text text-transparent mr-1">
            AI 解读：
          </span>
            {aiResult.summary}
          </p>

          {/* 高亮标签 */}
          {aiResult.highlight_label && aiResult.highlight_label.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {aiResult.highlight_label.map((label: string, index: number) => (
                <span
                  key={index}
                  className="bg-blue-100 dark:bg-blue-500/80 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };
  
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
    const base = item.user_link;
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
      return getProxiedImageUrl(currentUser.avatar);
    }
    // 回退到默认头像 URL
    return `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${item.user_id}.png`;
  };
  
  // 处理推文文本中的特殊标记（@用户名、#话题标签、$股票标签）
  const processTextWithLinks = (text: string) => {
    if (!text) return null;
    
    // 正则表达式匹配 @用户名、#话题标签、$股票标签
    // @用户名和#话题标签：支持中英文、数字、下划线、连字符
    // $股票标签：必须以英文字母开头，只包含英文字母+数字+下划线+连字符，最长15个字符
    const regex = /(@[a-zA-Z0-9_\u4e00-\u9fa5-]+)|(\$[a-zA-Z][a-zA-Z0-9_-]{0,14})|(#[a-zA-Z0-9_\u4e00-\u9fa5-]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的普通文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const matchedText = match[0];
      let href = '';
      
      if (matchedText.startsWith('@')) {
        // @用户名 -> https://x.com/username
        const username = matchedText.slice(1);
        href = `https://x.com/${username}`;
      } else if (matchedText.startsWith('$')) {
        // $股票标签 -> https://x.com/search?q=%24xxxx&src=cashtag_click
        const symbol = matchedText.slice(1);
        href = `https://x.com/search?q=%24${symbol}&src=cashtag_click`;
      } else if (matchedText.startsWith('#')) {
        // #话题标签 -> https://x.com/hashtag/xxxx
        const hashtag = matchedText.slice(1);
        href = `https://x.com/hashtag/${hashtag}`;
      }
      
      // 添加链接元素
      parts.push(
        <a
          key={`${match.index}-${matchedText}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
          onClick={(e) => e.stopPropagation()} // 防止事件冒泡
        >
          {matchedText}
        </a>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    // 添加剩余的普通文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // 在正文中遇到 "RT @" 或 "quoted From @"（非开头）插入分割线
  const renderTextWithSeparators = (text: string) => {
    if (!text) return null;
    
    // 匹配 RT @ 或 quoted From @ 模式
    const separatorRegex = /(RT\s@|quoted From\s@)/gi;
    const firstNonWs = text.search(/\S/);
    const insertPositions: number[] = [];
    let match: RegExpExecArray | null;
    
    while ((match = separatorRegex.exec(text)) !== null) {
      const idx = match.index;
      // 只在非开头位置插入分割线
      if (idx > -1 && idx !== firstNonWs) {
        insertPositions.push(idx);
      }
    }

    if (insertPositions.length === 0) {
      // return processTextWithLinks(text);
      return <span>
        <CollapsibleText 
          text={text}
          renderContent={(text) => processTextWithLinks(text)}
        />
      </span>
    }

    const parts: ReactNode[] = [];
    let prev = 0;
    insertPositions.forEach((pos, i) => {
      if (pos > prev) {
        const segment = text.slice(prev, pos);
        parts.push(
          <span key={`seg-${i}`}>
            <CollapsibleText 
              text={segment}
              renderContent={(text) => processTextWithLinks(text)}
            />
          </span>
        );
      }
      // 添加分割线
      parts.push(
        <div key={`sep-${i}`} className="border-t border-gray-200 dark:border-gray-700 my-3 pt-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {text.slice(pos).startsWith('RT @') ? '转推' : '引用'}
          </div>
        </div>
      );
      prev = pos;
    });
    
    if (prev < text.length) {
      const segment = text.slice(prev);
      parts.push(
        <span key={`seg-last`}>
          <CollapsibleText 
            text={segment}
            renderContent={(text) => processTextWithLinks(text)}
          />
        </span>
      );
    }
    
    return parts;
  };

  // 渲染推文内容
  const renderTweetContent = (data: Record<string, unknown>, isSubItem: boolean = false) => {
    const fullText = data.full_text as string;
    const urls = data.urls as Record<string, string[]>;
    const medias = data.medias as Record<string, string[]>;
    
    return (
      <div className={`${isSubItem ? 'ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700' : ''}`}>
        {fullText && (
          <div className="mb-3">
            {renderTextWithSeparators(fullText)}
          </div>
        )}
        
        {/* 链接 */}
        {urls && Object.keys(urls).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full mb-2">
              链接
            </div>
            <div className="space-y-1">
              {Object.entries(urls).map(([, links]) =>
                links
                  .filter((link: string) => link !== null)
                  .map((link: string, index: number) => {
                    // 根据屏幕尺寸调整截断长度
                    const getMaxLength = () => {
                      if (typeof window !== 'undefined') {
                        return window.innerWidth < 640 ? 25 : window.innerWidth < 768 ? 35 : 45;
                      }
                      return 35; // 默认值
                    };
                    
                    const maxLength = getMaxLength();
                    const displayText = link.length > maxLength ? `${link.substring(0, maxLength)}...` : link;
                    
                    return (
                      <div key={index} className="w-full">
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm hover:underline break-all w-full"
                          title={link} // 显示完整链接作为提示
                        >
                          <ExternalLink size={14} className="mr-1 mt-0.5 flex-shrink-0" />
                          <span className="break-all">{displayText}</span>
                        </a>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
        
        {/* 媒体 */}
        {medias && Object.keys(medias).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs rounded-full mb-2">
              媒体
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(medias).map(([, mediaLinks]) =>
                mediaLinks.map((media: string, index: number) => (
                  <div key={index} className="relative">
                    <Image
                      src={getProxiedImageUrl(media)}
                      alt="媒体内容"
                      width={200}
                      height={96}
                      className="w-full h-24 object-cover rounded-lg border cursor-zoom-in"
                      onClick={() => setPreviewImage(media)}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png';
                      }}
                      unoptimized
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

  // 提取展示的创建时间，实现相对时间显示
  const getDisplayCreatedAt = (x: XData): string => {
    const rawData: unknown = x.data;
    let createdAt: string | undefined;
    if (Array.isArray(rawData)) {
      const first = rawData[0] as unknown;
      if (first && typeof first === 'object' && first !== null) {
        const firstObj = first as Record<string, unknown>;
        const nested = firstObj['data'];
        if (nested && typeof nested === 'object' && nested !== null) {
          const val = (nested as Record<string, unknown>)['created_at'];
          if (typeof val === 'string') {
            createdAt = val;
          }
        }
      }
    } else if (rawData && typeof rawData === 'object') {
      const val = (rawData as Record<string, unknown>)['created_at'];
      if (typeof val === 'string') {
        createdAt = val;
      }
    }
    const finalVal = createdAt ?? x.created_at;
    return formatRelativeTime(finalVal);
  };


  return (
    <div 
      className={`p-3 sm:p-4 border rounded-lg transition-all w-full ${
        isTouched 
          ? 'border-blue-500 ring-1 ring-blue-500 bg-gray-50 dark:bg-gray-800' 
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-500 hover:ring-1 hover:ring-blue-500'
      }`}
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setIsTouched(false)}
      onTouchCancel={() => setIsTouched(false)}
    >
      {/* 头部信息 */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* 用户头像 */}
          {item.user_id && (
            <Image
              src={getAvatarUrl()}
              alt={currentUser?.user_name || item.username || '用户'}
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 border flex-shrink-0"
              onError={(e) => {
                // 使用与用户列表相同的错误处理逻辑
                const userName = currentUser?.user_name || item.username || '用户';
                (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23e5e7eb"/><text x="20" y="25" text-anchor="middle" fill="%236b7280" font-size="12">${userName.charAt(0).toUpperCase()}</text></svg>`;
              }}
              unoptimized
            />
          )}
          
          <div className="min-w-0 flex-1">
            {/* 用户名和链接 */}
            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">
              {item.user_link ? (
                <a
                  href={item.user_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                >
                  @{item.username || '未知用户'}
                </a>
              ) : (
                `@${item.username || '未知用户'}`
              )}
            </div>
            {/* 时间显示在用户名下方 */}
            <div className="text-xs text-gray-400 mt-1">
              {getDisplayCreatedAt(item)}
            </div>
          </div>
        </div>
        
        {/* 原文链接图标 */}
        {originalUrl && (
          <div className="flex items-center ml-2 flex-shrink-0">
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="查看原文"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        )}

        <div className="flex items-center ml-2 flex-shrink-0">
            <a
              href={`/x/snapshot/${encodeURIComponent(item.x_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="快照"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              data-no-snapshot
            >
              <Camera size={16} />
            </a>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="border-t pt-3">
        {/* AI分析结果 - 放在正文开头 */}
        {renderAIAnalysis()}
        
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">数据内容预览：</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 max-h-20 overflow-y-auto break-all">
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
          <Image
            src={getProxiedImageUrl(previewImage)}
            alt="预览"
            width={800}
            height={600}
            className="max-h-[90vh] max-w-[90vw] rounded shadow-xl cursor-zoom-out object-contain"
            onClick={() => setPreviewImage(null)}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png';
            }}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
